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

  // Hitbox part tags (pass 7b): damageEnemy reads userData.part to pick the
  // damage tier from the type's HITBOX table. Tag at creation, per mesh —
  // an untagged mesh falls back to torso damage (guarded in enemies.js).
  // Pass 7c splits 'limb': LEGS (thighs, shins, feet) tag 'leg' so leg
  // damage is trackable for the crawl transition; arms keep 'limb'. Damage
  // tiers are identical (LEG === LIMB, suite-pinned) — only the accounting
  // differs.
  const tag = (mesh, part) => {
    mesh.userData.part = part;
    return mesh;
  };

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

  // Waist joint (7c.2): a group pivoted at the belly/chest seam — the
  // centre of the 0.08 overlap band that hides the join. Chest, head
  // (jaw/eyes ride as its children), and both arm chains re-parent into
  // it with positions re-expressed relative to the pivot, so at
  // rotation.x = 0 the body is WORLD-IDENTICAL to the pre-waist build
  // (suite §11 pins the head and shoulders to the registry-derived stack
  // exactly). Prone, a negative counter-bend raises chest/head/arms off
  // the flattened pelvis — the sphinx silhouette (7c.2).
  const waistY = bellyTop - 0.04;
  const waist = new THREE.Group();
  waist.position.set(0, waistY, 0);
  group.add(waist);

  // Legs (two segments): THIGH pivots at the hip, SHIN pivots at the knee
  // (a child, origin at the joint), the foot rides the shin. Joint sits
  // KNEE_AT down the limb (research rule: ~55%). Rest pose bakes the slight
  // permanent knee bend — the shuffle-crouch stance.
  const thighLen = B.LEG.LEN * B.LEG.KNEE_AT;
  const shinLen = B.LEG.LEN - thighLen;
  const thighGeo = new THREE.BoxGeometry(B.LEG.W, thighLen, B.LEG.D);
  thighGeo.translate(0, -thighLen / 2, 0); // extends DOWN from the hip
  const shinGeo = new THREE.BoxGeometry(B.LEG.W * 0.92, shinLen + 0.04, B.LEG.D * 0.92);
  shinGeo.translate(0, -(shinLen + 0.04) / 2 + 0.02, 0); // slight overlap hides the knee join

  const legL = tag(new THREE.Mesh(thighGeo, cloth), 'leg');
  legL.position.set(-B.LEG.X, hipTop, 0);
  const shinL = tag(new THREE.Mesh(shinGeo, cloth), 'leg');
  shinL.position.set(0, -thighLen, 0); // the knee
  shinL.rotation.x = type.ANIM.KNEE_REST;
  legL.add(shinL);

  const legR = tag(new THREE.Mesh(thighGeo.clone(), cloth), 'leg');
  legR.position.set(B.LEG.X, hipTop, 0);
  const shinR = tag(new THREE.Mesh(shinGeo.clone(), cloth), 'leg');
  shinR.position.set(0, -thighLen, 0);
  shinR.rotation.x = type.ANIM.KNEE_REST;
  legR.add(shinR);
  group.add(legL, legR);

  // Feet: dark ground anchors, toes forward, riding the shins.
  const footGeo = new THREE.BoxGeometry(B.FOOT.W, B.FOOT.H, B.FOOT.D);
  const footL = tag(new THREE.Mesh(footGeo, feetMat), 'leg');
  footL.position.set(0, -(shinLen + B.FOOT.H / 2), B.FOOT.FWD);
  footL.rotation.x = -type.ANIM.KNEE_REST; // flat-footed under the shuffle bend
  shinL.add(footL);
  const footR = tag(new THREE.Mesh(footGeo.clone(), feetMat), 'leg');
  footR.position.set(0, -(shinLen + B.FOOT.H / 2), B.FOOT.FWD);
  footR.rotation.x = -type.ANIM.KNEE_REST;
  shinR.add(footR);

  // Belly: the narrower lower torso the chest hunches over.
  const belly = tag(new THREE.Mesh(
    new THREE.BoxGeometry(B.BELLY.W, B.BELLY.H, B.BELLY.D), cloth,
  ), 'torso');
  belly.position.set(0, bellyY, 0);
  group.add(belly);

  // Chest: wider, pushed forward and tilted — the question-mark spine.
  const chest = tag(new THREE.Mesh(
    new THREE.BoxGeometry(B.CHEST.W, B.CHEST.H, B.CHEST.D), cloth,
  ), 'torso');
  chest.position.set(0, chestY - waistY, B.CHEST.FWD);
  chest.rotation.x = B.CHEST.HUNCH; // positive = top toward +Z = forward
  waist.add(chest);

  // Head: oversized, jutting FORWARD off the chest top; cocked sideways,
  // face tilted up (negative X pitches the +Z face upward) — the lolling
  // under-the-brow stare. Jaw and eyes are CHILDREN so any future head
  // animation carries them for free.
  const head = tag(new THREE.Mesh(
    new THREE.BoxGeometry(B.HEAD.W, B.HEAD.H, B.HEAD.D), skin,
  ), 'head');
  head.position.set(0, headY - waistY, B.CHEST.FWD + B.HEAD.FWD);
  head.rotation.z = B.HEAD.COCK;
  head.rotation.x = B.HEAD.TILT;
  waist.add(head);

  const jaw = tag(new THREE.Mesh(
    new THREE.BoxGeometry(B.JAW.W, B.JAW.H, B.JAW.D), skin,
  ), 'head');
  jaw.position.set(0, -(B.HEAD.H / 2 + B.JAW.DROP), B.JAW.FWD);
  head.add(jaw);

  const eyeGeo = new THREE.BoxGeometry(B.EYE.SIZE, B.EYE.SIZE, B.EYE.SIZE);
  const eyeL = tag(new THREE.Mesh(eyeGeo, eyeMat), 'head');
  eyeL.position.set(-B.EYE.X, B.EYE.Y, B.HEAD.D / 2 + B.EYE.FWD);
  const eyeR = tag(new THREE.Mesh(eyeGeo.clone(), eyeMat), 'head');
  eyeR.position.set(B.EYE.X, B.EYE.Y, B.HEAD.D / 2 + B.EYE.FWD);
  head.add(eyeL, eyeR);

  // Arms (two segments): UPPER pivots at the shoulder — the contract every
  // arm animation relies on (rotating armL/armR carries the whole chain).
  // FOREARM pivots at the elbow (ELBOW_AT down the limb), rest pose bakes
  // the elbow droop; the hand rides the forearm. The strike animation
  // extends the elbow — the swipe becomes a reaching lunge (enemies.js).
  const upperLen = B.ARM.LEN * B.ARM.ELBOW_AT;
  const foreLen = B.ARM.LEN - upperLen;
  const upperGeo = new THREE.BoxGeometry(B.ARM.W, upperLen, B.ARM.D);
  upperGeo.translate(0, upperLen / 2, 0); // extends +Y from the shoulder
  const foreGeo = new THREE.BoxGeometry(B.ARM.W * 0.92, foreLen + 0.04, B.ARM.D * 0.92);
  foreGeo.translate(0, (foreLen + 0.04) / 2 - 0.02, 0); // overlap hides the elbow join

  const armL = tag(new THREE.Mesh(upperGeo, skin), 'limb');
  armL.position.set(-B.ARM.X, B.ARM.Y - waistY, B.ARM.FWD);
  armL.rotation.x = B.ARM.REST_RAD;
  const foreL = tag(new THREE.Mesh(foreGeo, skin), 'limb');
  foreL.position.set(0, upperLen, 0); // the elbow
  foreL.rotation.x = type.ANIM.ELBOW_BEND;
  armL.add(foreL);

  const armR = tag(new THREE.Mesh(upperGeo.clone(), skin), 'limb');
  armR.position.set(B.ARM.X, B.ARM.Y - waistY, B.ARM.FWD);
  armR.rotation.x = B.ARM.REST_RAD;
  const foreR = tag(new THREE.Mesh(foreGeo.clone(), skin), 'limb');
  foreR.position.set(0, upperLen, 0);
  foreR.rotation.x = type.ANIM.ELBOW_BEND;
  armR.add(foreR);
  waist.add(armL, armR);

  const handGeo = new THREE.BoxGeometry(B.HAND.SIZE, B.HAND.SIZE, B.HAND.SIZE);
  const handL = tag(new THREE.Mesh(handGeo, skin), 'limb');
  handL.position.set(0, foreLen + B.HAND.SIZE / 2 - 0.06, 0);
  foreL.add(handL);
  const handR = tag(new THREE.Mesh(handGeo.clone(), skin), 'limb');
  handR.position.set(0, foreLen + B.HAND.SIZE / 2 - 0.06, 0);
  foreR.add(handR);

  return {
    group,
    parts: { armL, armR, foreL, foreR, legL, legR, shinL, shinR, head, jaw, waist },
    materials: [skin, cloth, feetMat, eyeMat],
    // The eye material by NAME (pass 14). It is already inside `materials`,
    // but the exploder's pulse needs to drive THIS one specifically, and
    // reaching for it by array index — or by sniffing for the only material
    // without .emissive, the way setFlash discriminates — would break
    // silently the day a body gains a second unlit material. Both eyes share
    // it, so one write throbs the pair.
    eyeMat,
  };
}
