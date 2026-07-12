// render/enemyBody.js — the designed zombie body (pass 7a, Direction A:
// "the Shambler"). Every dimension comes from the type's BODY registry
// block, so a future enemy type gets a different body as pure data — no
// code. Anatomy per the research digest: spine + limb chains + head
// features; oversized forward-jutting head (the silhouette LEADS with it);
// hunched chest; long dangling arms with hands; short stiff legs on dark
// ground-anchor feet; hanging jaw; unlit glowing eyes.
//
// Build convention (MEASURED, do not "fix"): the body faces +Z, and
// rotation.y = atan2(dx, dz) points it at the player. Positive rotation.x
// tips the top toward +Z (forward) — that's the hunch. Camera/gun space
// runs −Z-forward, but BODY-LOCAL forward here is +Z; the suite's body
// geometry section asserts the forward signs so a slip fails in Node,
// not in the browser (LESSONS 2026-07-12, the ejection-port class).
//
// Factory only, no module-scope side effects: suite-import safe.

import * as THREE from '../../lib/three.module.js';

export function buildBody(type) {
  const B = type.BODY;
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: type.COLORS.SKIN, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: type.COLORS.CLOTH, roughness: 0.95 });
  const feetMat = new THREE.MeshStandardMaterial({ color: type.COLORS.FEET, roughness: 1.0 });
  // Eyes are UNLIT and FOG-FREE on purpose: two pinprick lights that punch
  // through the Waves murk before the body resolves. No .emissive property —
  // setFlash in enemies.js guards for that.
  const eyeMat = new THREE.MeshBasicMaterial({ color: type.COLORS.EYES, fog: false });

  // — Height stack, derived bottom-up so the parts always meet: feet carry
  // legs carry belly carries chest; small overlaps hide the joins.
  const hipTop = B.FOOT.H + B.LEG.LEN;
  const bellyY = hipTop + B.BELLY.H / 2 - 0.06;
  const bellyTop = bellyY + B.BELLY.H / 2;
  const chestY = bellyTop + B.CHEST.H / 2 - 0.08;
  const headY = chestY + B.CHEST.H / 2 * Math.cos(B.CHEST.HUNCH) + B.HEAD.H / 2 - 0.06;

  // Feet: dark ground anchors, toes forward.
  const footGeo = new THREE.BoxGeometry(B.FOOT.W, B.FOOT.H, B.FOOT.D);
  const footL = new THREE.Mesh(footGeo, feetMat);
  footL.position.set(-B.LEG.X, B.FOOT.H / 2, B.FOOT.FWD);
  const footR = new THREE.Mesh(footGeo.clone(), feetMat);
  footR.position.set(B.LEG.X, B.FOOT.H / 2, B.FOOT.FWD);
  group.add(footL, footR);

  // Legs: short and stiff — the shamble reads in the upper body.
  const legGeo = new THREE.BoxGeometry(B.LEG.W, B.LEG.LEN, B.LEG.D);
  const legL = new THREE.Mesh(legGeo, cloth);
  legL.position.set(-B.LEG.X, B.FOOT.H + B.LEG.LEN / 2, 0);
  const legR = new THREE.Mesh(legGeo.clone(), cloth);
  legR.position.set(B.LEG.X, B.FOOT.H + B.LEG.LEN / 2, 0);
  group.add(legL, legR);

  // Belly: the narrower lower torso the chest hunches over.
  const belly = new THREE.Mesh(
    new THREE.BoxGeometry(B.BELLY.W, B.BELLY.H, B.BELLY.D), cloth,
  );
  belly.position.set(0, bellyY, 0);
  group.add(belly);

  // Chest: wider, pushed forward and tilted — the question-mark spine.
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(B.CHEST.W, B.CHEST.H, B.CHEST.D), cloth,
  );
  chest.position.set(0, chestY, B.CHEST.FWD);
  chest.rotation.x = B.CHEST.HUNCH; // positive = top toward +Z = forward
  group.add(chest);

  // Head: oversized, jutting FORWARD off the chest top; cocked sideways,
  // face tilted up (negative X pitches the +Z face upward) — the lolling
  // under-the-brow stare. Jaw and eyes are CHILDREN so any future head
  // animation carries them for free.
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(B.HEAD.W, B.HEAD.H, B.HEAD.D), skin,
  );
  head.position.set(0, headY, B.CHEST.FWD + B.HEAD.FWD);
  head.rotation.z = B.HEAD.COCK;
  head.rotation.x = B.HEAD.TILT;
  group.add(head);

  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(B.JAW.W, B.JAW.H, B.JAW.D), skin,
  );
  jaw.position.set(0, -(B.HEAD.H / 2 + B.JAW.DROP), B.JAW.FWD);
  head.add(jaw);

  const eyeGeo = new THREE.BoxGeometry(B.EYE.SIZE, B.EYE.SIZE, B.EYE.SIZE);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-B.EYE.X, B.EYE.Y, B.HEAD.D / 2 + B.EYE.FWD);
  const eyeR = new THREE.Mesh(eyeGeo.clone(), eyeMat);
  eyeR.position.set(B.EYE.X, B.EYE.Y, B.HEAD.D / 2 + B.EYE.FWD);
  head.add(eyeL, eyeR);

  // Arms: origin at the SHOULDER (geometry translated +Y) so rotation.x
  // pivots there — the contract every arm animation relies on. Rest pose is
  // BODY.ARM.REST_RAD (slightly below horizontal: dangling-reaching), and
  // the attack/wobble code anchors on the same value. Hands are children,
  // riding every swing as reaching claws.
  const armGeo = new THREE.BoxGeometry(B.ARM.W, B.ARM.LEN, B.ARM.D);
  armGeo.translate(0, B.ARM.LEN / 2, 0);
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.set(-B.ARM.X, B.ARM.Y, B.ARM.FWD);
  armL.rotation.x = B.ARM.REST_RAD;
  const armR = new THREE.Mesh(armGeo.clone(), skin);
  armR.position.set(B.ARM.X, B.ARM.Y, B.ARM.FWD);
  armR.rotation.x = B.ARM.REST_RAD;
  group.add(armL, armR);

  const handGeo = new THREE.BoxGeometry(B.HAND.SIZE, B.HAND.SIZE, B.HAND.SIZE);
  const handL = new THREE.Mesh(handGeo, skin);
  handL.position.set(0, B.ARM.LEN + B.HAND.SIZE / 2 - 0.06, 0);
  armL.add(handL);
  const handR = new THREE.Mesh(handGeo.clone(), skin);
  handR.position.set(0, B.ARM.LEN + B.HAND.SIZE / 2 - 0.06, 0);
  armR.add(handR);

  return {
    group,
    parts: { armL, armR, head, jaw },
    materials: [skin, cloth, feetMat, eyeMat],
  };
}
