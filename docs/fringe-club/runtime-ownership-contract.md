# Stage 2H ownership contract

One SourceAsset owns one fully parsed, validated, self-contained static GLB. There is no module singleton, implicit global parsed-asset cache, or simulator registration. It keeps a single explicit owner lease and one lease per instance.

| Resource | Owner / sharing | Release |
|---|---|---|
| Source scene and source material templates | SourceAsset; scene never attached | Final source lease |
| BufferGeometry, metric UV, normals and tangents | Shared immutable within that source | Final source lease, once per unique geometry |
| Texture wrappers / embedded ImageBitmap backing | Shared immutable within that source | Texture.dispose then unique ImageBitmap.close at final lease |
| Root, transform, visibility, child graph / userData | Each instance | Remove root; clear graph; drop tracked reference |
| Material instances and material userData | Clone once per source material per instance | Dispose unique instance materials, never source templates or textures |
| PMREM, radiance probes, lights / shadows, transmission targets and renderer | Harness/application owner | Independent harness teardown; never the asset disposer |

Instances clone the static object tree with deep JSON userData and clone materials. Geometry and textures remain shared by design. Material color/roughness mutations are isolated, although production appearance is frozen. Mutation of shared geometry or textures is prohibited. A separate caller-owned deep copy is required for independent texture edits. Sampler configuration is one declared source-wide initialization policy, not a per-instance mutable setting.

SourceAsset.dispose releases the owner lease and prevents new instances. Existing instances remain valid. Their paired, idempotent disposers release remaining leases. The final lease destroys source resources; disposing A never destroys B's maps or buffers. No reference counting is hidden in Three.js. Separate SourceAsset.load calls own independent parses and resources and multiply memory; reuse a source deliberately for multiple instances.

The wrapper performs abortable fetch followed by GLTFLoader.parseAsync. The harness cancels superseded loads and checks a generation token before attaching any returned source; stale completion is disposed, never silently adopted. Fetch cancellation works. Parsing itself cannot be interrupted safely: a late-aborted fully parsed source is disposed before delivery. HTTP 404, malformed header, Blob load, early/mid-fetch and late-parse cancellation were tested. The contract is for these validated embedded-image packages; arbitrary external-image GLTF and partial decoder failure cleanup are outside this package claim.

The wrapper does not retain network bytes or the GLTF parser. HTTP caching does not change resource ownership. Three 0.186 Cache ignores Blob URL keys, so enabling it did not accumulate this GLB's embedded images. The disposer additionally removes only cache entries whose values are its own images; it never clears another source's cache. Future external-image caching requires a separate backing-image sharing contract.

Asset unload leaves the renderer and validation environment alive. Their baseline counts are stable, not zero. The standalone harness separately disposes captured render targets, PMREM, probes, lights and LTC lookup textures, then disposes and loses its dedicated WebGL context. A renderer-internal texture and, after sun tests, a shadow program can remain before context loss; all observed GL handles are invalid after dedicated-context teardown. This is not an asset resource leak. Context loss must never be used to unload one asset from a shared application renderer.

Future registry instances can own their explicit source lease and paired disposer. Async preload, feature flags, instance registration and application teardown belong to Stage 2I. No registry was edited here.
