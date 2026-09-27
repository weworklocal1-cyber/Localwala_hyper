import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import { StagingGeoRepository } from '../../src/geo/geo.repository.js';
import { GeoService } from '../../src/geo/geo.service.js';

describe('GeoService', () => {
  let geoRepo: StagingGeoRepository;
  let geoService: GeoService;

  beforeEach(() => {
    geoRepo = new StagingGeoRepository();
    geoService = new GeoService(geoRepo);
  });

  it('throws BLOCKED on createEntity (staging repo)', async () => {
    await expect(geoService.createEntity({ type: 'city', name: 'Test City' })).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on getEntity (staging repo)', async () => {
    await expect(geoService.getEntity('geo_1')).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on updateEntity (staging repo)', async () => {
    await expect(geoService.updateEntity('geo_1', { name: 'Updated' })).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on deleteEntity (staging repo)', async () => {
    await expect(geoService.deleteEntity('geo_1')).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on setActive (staging repo)', async () => {
    await expect(geoService.setActive('geo_1', false)).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on listEntities (staging repo)', async () => {
    await expect(geoService.listEntities('city')).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on resolveLocality (staging repo)', async () => {
    await expect(geoService.resolveLocality(17.385, 78.4867)).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on checkServiceability (staging repo)', async () => {
    await expect(geoService.checkServiceability(17.385, 78.4867)).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on getZonesInCity (staging repo)', async () => {
    await expect(geoService.getZonesInCity('city_1')).rejects.toThrow('Geo repository not configured');
  });

  it('throws BLOCKED on getLocalitiesInZone (staging repo)', async () => {
    await expect(geoService.getLocalitiesInZone('zone_1')).rejects.toThrow('Geo repository not configured');
  });
});