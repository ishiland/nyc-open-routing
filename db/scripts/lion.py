import psycopg2
import os
import sys
import string
from datetime import datetime

dir_path = os.path.dirname(os.path.realpath(__file__))

user = os.getenv('POSTGRES_USER')
password = os.getenv('POSTGRES_PASSWORD')
database = os.getenv('POSTGRES_DB')
port = os.getenv('POSTGRES_PORT', 5432)
GDB = os.getenv('GDB')

connection_string = "user={} dbname={} password={} port={}".format(
    user,
    database,
    password,
    port
)

conn = psycopg2.connect(connection_string)

cur = conn.cursor()

# topology tolerance
tolerance = '0.00001'


def create_edges():
    print('\nCreating edges table and calculating network costs...')

    # fixes some data issues in LION first
    data_fixes_sql = open(os.path.join(dir_path, 'sql', 'data_fixes.sql'), 'r')
    cur.execute(data_fixes_sql.read())

    # create edges table from LION
    create_edges_sql = open(os.path.join(dir_path, 'sql', 'create_edges.sql'), 'r')
    cur.execute(create_edges_sql.read())

    # calculate segment costs
    calc_costs_sql = open(os.path.join(dir_path, 'sql', 'calculate_costs.sql'), 'r')
    cur.execute(calc_costs_sql.read())


def create_topology():
    # Generates topology for newly created `edges` table.

    cur.execute("SELECT MIN(id), MAX(id) FROM edges;")

    min_id, max_id = cur.fetchone()
    total = max_id - min_id + 1

    print("\nCreating Topology for {} edges...".format(total))
    interval = 10000
    for x in range(min_id, max_id + 1, interval):
        cur.execute("select pgr_createTopology('edges', {}, 'the_geom', 'id', rows_where:='id>={} and id<{}');".format(
            tolerance, x, x + interval))
        conn.commit()
        percent = round(100 * float(x) / float(total), 0)
        sys.stdout.write("\r{}%".format(percent))
        sys.stdout.flush()
    sys.stdout.write("\r{}%".format(100))
    sys.stdout.flush()


def error_check():
    # analyze graph and one way segments, checking for errors.

    print('\n\nAnalyzing Graph...')
    cur.execute("SELECT pgr_analyzeGraph('edges', {}, 'the_geom');".format(tolerance))
    print(cur.fetchone()[0])

    print('Analyzing One Way...')
    cur.execute(
        "SELECT pgr_analyzeOneway('edges', ARRAY ['', 'B', 'W'], ARRAY ['', 'B', 'A'], ARRAY ['', 'B', 'W'], ARRAY ['', 'B', 'A'], oneway := 'trafdir');")
    print(cur.fetchone()[0])


def find_turn_restrictions():
    # TODO
    '''
    Creates a turn restrictions table for grade-separation intersections.
    '''
    print('\nFinding Grade Separation Turn Restrictions...')
    restrictions_sql = open(os.path.join(dir_path, 'sql', 'restrictions.sql'), 'r')
    cur.execute(restrictions_sql.read())

    cur.execute("SELECT id, source, target, nodelevelf, nodelevelt, trafdir FROM edges;")

    all_rows = cur.fetchall()
    total = len(all_rows)

    for idx, row in enumerate(all_rows):
        edge_id = row[0]
        target_node_id = row[2]
        if row[4].isalpha():
            seg_level_to_idx = string.ascii_uppercase.index(row[4])
        else:
            seg_level_to_idx = 50

        # find target => source turns
        sql = "select id, nodelevelf, nodelevelt from edges where source ={};".format(target_node_id)
        cur.execute(sql)
        row_result = cur.fetchall()

        for r in row_result:

            if r[1].isalpha():
                seg2_level_from_idx = string.ascii_uppercase.index(r[1])
            else:
                seg2_level_from_idx = 50
            if seg2_level_from_idx != seg_level_to_idx:
                if seg2_level_from_idx + 1 != seg_level_to_idx:
                    if seg2_level_from_idx - 1 != seg_level_to_idx:
                        # this is a grade separation turn restriction!
                        cur.execute(
                            "INSERT INTO restrictions (to_cost,to_edge,from_edge) VALUES (100,{},{});".format(r[0],
                                                                                                              edge_id))
                        conn.commit()

        percent = round(100 * float(idx) / float(total), 0)
        sys.stdout.write("\r{}%".format(percent))
        sys.stdout.flush()


def create_functions():
    print("\n\nCreating routing functions...")
    # create functions to execute routing
    functions_sql = open(os.path.join(dir_path, 'sql', 'functions.sql'), 'r')
    cur.execute(functions_sql.read())


if __name__ == '__main__':
    startTime = datetime.now()
    try:
        cur.execute('CREATE EXTENSION pgrouting;')
    except Exception as e:
        print(e)
        pass
    create_edges()
    create_topology()
    error_check()
    # find_turn_restrictions()
    create_functions()
    conn.commit()
    delta = datetime.now() - startTime
    print("\nFinished in {}".format(delta))
