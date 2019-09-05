-- Some data issues were discovered. DCP has been notified and will update for next release (19c).
UPDATE lion set trafdir = 'W' where segmentid = '0240522';
UPDATE lion set trafdir = 'A' where segmentid = '0240529';
UPDATE lion set trafdir = 'P' where segmentid in ('0110639', '0032768');