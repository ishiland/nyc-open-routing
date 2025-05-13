import { describe, it, expect } from 'vitest';
import { getAddressLabel } from './address';
import { AddressProperties } from '../types/interfaces';

describe('getAddressLabel', () => {
  it('should format a complete address with all parts', () => {
    const addressProperties: AddressProperties = {
      'House Number - Display Format': '123',
      'First Street Name Normalized': 'Main St',
      'First Borough Name': 'Manhattan'
    };

    expect(getAddressLabel(addressProperties)).toBe('123 Main St Manhattan');
  });

  it('should handle missing house number', () => {
    const addressProperties: AddressProperties = {
      'First Street Name Normalized': 'Broadway',
      'First Borough Name': 'Manhattan'
    };

    expect(getAddressLabel(addressProperties)).toBe('Broadway Manhattan');
  });

  it('should handle missing street name', () => {
    const addressProperties: AddressProperties = {
      'House Number - Display Format': '123',
      'First Borough Name': 'Manhattan'
    };

    expect(getAddressLabel(addressProperties)).toBe('123 Manhattan');
  });

  it('should handle missing borough name', () => {
    const addressProperties: AddressProperties = {
      'House Number - Display Format': '123',
      'First Street Name Normalized': 'Main St'
    };

    expect(getAddressLabel(addressProperties)).toBe('123 Main St');
  });

  it('should return an empty string for an empty object', () => {
    const addressProperties: AddressProperties = {};

    expect(getAddressLabel(addressProperties)).toBe('');
  });
}); 