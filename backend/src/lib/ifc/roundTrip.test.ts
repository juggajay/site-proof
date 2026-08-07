import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { IFCBUILDINGELEMENTPROXY, IfcAPI } from 'web-ifc';

import { createDraftLotIfcFixture } from './fixture.js';
import { serializeDraftLotIfc } from './serializer.js';

describe('web-ifc round trip', () => {
  it('parses the IFC2X3 proxy, psets, and mesh', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'siteproof-ifc-'));
    const path = join(scratch, 'fixture.ifc');
    const api = new IfcAPI();
    let modelId: number | null = null;

    try {
      await writeFile(path, serializeDraftLotIfc(createDraftLotIfcFixture()), 'ascii');
      api.SetWasmPath(`${resolve('node_modules/web-ifc').replaceAll('\\', '/')}/`, true);
      await api.Init();
      modelId = api.OpenModel(new Uint8Array(await readFile(path)), {});

      expect(api.GetModelSchema(modelId)).toBe('IFC2X3');
      const proxyIds = api.GetLineIDsWithType(modelId, IFCBUILDINGELEMENTPROXY);
      expect(proxyIds.size()).toBe(1);
      const proxyId = proxyIds.get(0);
      expect(api.GetLine(modelId, proxyId).Name?.value).toBe('LOT-042');

      const psets = await api.properties.getPropertySets(modelId, proxyId, true);
      expect(psets.map((pset) => pset.Name?.value).sort()).toEqual(
        ['Asset Management', 'CIVOS_QA', 'Construction', 'Design', 'Project'].sort(),
      );
      const properties = Object.fromEntries(
        psets.flatMap((pset) =>
          (pset.HasProperties ?? []).map(
            (property: NonNullable<typeof pset.HasProperties>[number]) => [
              `${pset.Name?.value}.${property.Name?.value}`,
              property.NominalValue?.value,
            ],
          ),
        ),
      );
      expect(properties['Construction.ConstructionLotNumber']).toBe('LOT-042');
      expect(properties['Project.Datum']).toBe('GDA2020');
      expect(properties['CIVOS_QA.GeometrySource']).toBe('LotRecords (not survey)');

      let vertexCount = 0;
      api.StreamAllMeshes(modelId, (mesh) => {
        for (let index = 0; index < mesh.geometries.size(); index += 1) {
          const placedGeometry = mesh.geometries.get(index);
          const geometry = api.GetGeometry(modelId!, placedGeometry.geometryExpressID);
          vertexCount +=
            api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize()).length / 6;
          geometry.delete();
        }
      });
      expect(vertexCount).toBeGreaterThanOrEqual(8);
    } finally {
      if (modelId !== null) api.CloseModel(modelId);
      await rm(scratch, { recursive: true, force: true });
    }
  });
});
