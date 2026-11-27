# A1 — Ground Glass diagnostic qualification

This test-only slice adds evidence comparators and an independent optical reference to the existing production-shader depth-edge fixture. Existing Ground Glass variance assertions remain in place. Further qualification is required before these diagnostics can replace existing signals or support A2, A3 or A6.

## Contract and evidence matrix

| Contract | Status | Evidence and remaining work |
| --- | --- | --- |
| D1 Request and frame integrity | Partial | The test-side comparator rejects synthetic stale request, scene, channel, frame and generation mismatches. An actual earlier completed application frame and its association with the current transaction remain to be captured. |
| D2 Numerical and buffer integrity | Partial | Synthetic controls reject missing, stale and non-finite preparation, malformed RGBA8 buffers and uniform images. Actual current preparation and readback still need a common transaction witness. CPU numerical checks alone do not establish GPU correctness. |
| D3 Pipeline execution | Partial | The comparator distinguishes synthetic processed and Raw RTT bypass execution sequences. Actual stage completion and display witnesses associated with the completed request are still required. Raw display orientation and Raw RTT bypass are separate controls. |
| D4 Independent optical response | Partial | The WebGL2 depth-edge fixture runs production CoC and gather shaders and a fixture-only legacy depth-tolerance variant. Independent thin-lens CoC checks, focused and defocused local contrasts, foreground contamination and stopped-down response pass. Actual wrong-CoC, excessive-blur and unexpected-zero-blur negative controls remain unqualified in this slice. |
| D5 Raw/Upright orientation | Partial | The comparator and synthetic asymmetric controls reject one-axis reflections, unrotated mapping and ambiguous symmetric inputs. A current public application WebGL2 capture at seed 284719 measured RGB mean error 0 for the 180-degree mapping, 52.375 for horizontal reflection, 16.393 for vertical reflection and 52.572 for unrotated mapping. The retained tap predicts frame identity before completion, so same-transaction publication remains to be established. |
| D6 Legitimate content compatibility | Partial | Actual WebGL2 captures at material seeds 284719 and 1 changed rendered pixels under matched recorded optical state, with three identical frames per seed. Visible building-base and building-middle CoC samples matched across seeds. Global raw/final variance was 7561.842/3853.640 versus 6910.311/3469.850. Material-varying guide regions changed and an independent local optical-response comparison remains required. The retained tap does not establish completed-frame association. |

## Independent optical reference

For focal length f, subject distance D, focus distance F, and f-number N, all lengths in millimetres, the parallel thin-lens image distance is v(D) = fD / (D − f). The signed diameter at the film plane is (f / N) × (v(F) / v(D) − 1). Negative values correspond to foreground defocus and positive values to background defocus. The fixture uses f = 150 mm, front and back planes at 400 and 410 mm, and 16-bit source depth with 8-bit encoded CoC. Its test allows 0.15 mm for quantization.

The independent expectations for 410 mm at focus 400 mm and f/2.8, 400 mm at focus 390 mm and f/2.8, and 400 mm at focus 410 mm and f/1.4 are approximately +0.784, +0.837 and −1.545 mm. The local WebGL2 fixture observed +0.756, +0.850 and −1.500 mm respectively. In the focused-foreground case the measured candidate foreground edge red increase was 0 bytes and the fixture-only legacy variant was 82 bytes. These are GPU fixture measurements and do not establish public application completion or metrological calibration.

## Ownership and follow-up

The WebGL renderer owns actual pass execution and completed frame callbacks. The render host decides whether a completed frame is current and publishable. Subject generation and optical preparation must be associated with the same observed transaction as the captured pixels. The test-side comparator consumes such evidence and does not generate it. A test-only capture can instrument the render callback and completion boundary without changing production code, but the retained A0 tap predicts its frame identity before completion and therefore cannot establish that association.

Keep the whole-frame variance checks while replacement signals are independently qualified. Later consumers must use matched optical state, seed, backend and protected reference regions, and must separately test real content changes, fresh completion, pipeline bypass, blur, occlusion and orientation. A test-only capture that observes the real completion callback and display output is the next bounded slice.
