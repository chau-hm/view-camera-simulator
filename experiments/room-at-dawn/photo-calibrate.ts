import { calibrateCompoundFocusPlane } from '../../src/core/optics/calibrateCompoundFocusPlane';
import { calibrateVerticalPlaneSwing } from '../../src/core/optics/calibrateVerticalPlaneSwing';
const bed = calibrateCompoundFocusPlane({ focalLengthMm:90, subjectPlane:{point:{x:0,y:-530,z:0},normal:{x:0,y:-1,z:0}}, tiltRangeDeg:{min:-10,max:10}, swingRangeDeg:{min:-10,max:10},focusDistanceRangeMm:{min:100,max:8000},publicStep:{frontTiltDeg:0.1,frontSwingDeg:0.1,focusDistanceMm:10}});
const door = calibrateVerticalPlaneSwing({focalLengthMm:90,focusProbes:[{x:588,y:-200,z:2000},{x:588,y:-200,z:2350},{x:588,y:-200,z:2700}]});
console.log(JSON.stringify({bed,door},null,2));
