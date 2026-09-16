/* AMORA — 3D-сцена первого экрана (Three.js) */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const canvas = document.querySelector('[data-hero-canvas]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function supportsWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

if (canvas && supportsWebGL()) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const key = new THREE.DirectionalLight(0xffe6dc, 2.2);
  key.position.set(5, 6, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0xff3d2e, 60, 30);
  rim.position.set(-6, -2, -3);
  scene.add(rim);

  /* ---- Сердце ---- */
  const shape = new THREE.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);

  const heartGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 3.2, bevelEnabled: true, bevelSegments: 14, steps: 1,
    bevelSize: 2.4, bevelThickness: 2.6, curveSegments: 64
  });
  heartGeo.center();
  heartGeo.rotateZ(Math.PI);
  heartGeo.computeVertexNormals();

  const heartMat = new THREE.MeshPhysicalMaterial({
    color: 0xff2414, roughness: 0.2, metalness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.06,
    sheen: 0.35, sheenColor: new THREE.Color(0xff8a7a), sheenRoughness: 0.5,
    iridescence: 0.2, iridescenceIOR: 1.3
  });
  const heart = new THREE.Mesh(heartGeo, heartMat);
  heart.scale.setScalar(0.17);

  const heartGroup = new THREE.Group();
  heartGroup.add(heart);
  scene.add(heartGroup);

  /* ---- Парящие объекты: визитка, сфера, тор, мини-сердца ---- */
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xf2ece3, roughness: 0.35, clearcoat: 0.6 });
  const ink = new THREE.MeshPhysicalMaterial({ color: 0x1a1816, roughness: 0.15, metalness: 0.4, clearcoat: 1 });
  const red = heartMat;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 1 });

  const floaters = [];
  const addFloater = (mesh, pos, speed, amp, m) => {
    mesh.position.copy(pos);
    mesh.userData = { base: pos.clone(), m, speed, amp, phase: Math.random() * Math.PI * 2, rot: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.5) };
    scene.add(mesh);
    floaters.push(mesh);
  };

  // pos — для десктопа (мировые координаты), m — для мобильных: [доля halfW, доля halfH, z] или null (скрыть)
  addFloater(new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.4, 0.08, 4, 0.08), cream), new THREE.Vector3(6.2, 3.3, -2.5), 0.6, 0.3, null);
  addFloater(new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 48), ink), new THREE.Vector3(5.6, -2.6, 0.5), 0.8, 0.35, [0.8, 0.42, -2]);
  addFloater(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.26, 32, 80), chrome), new THREE.Vector3(0.6, 3.9, -4), 0.5, 0.3, [-0.7, 0.7, -4]);
  addFloater(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 8, 24), cream), new THREE.Vector3(6.9, 0.2, -1.5), 0.7, 0.3, null);
  const miniHeart = new THREE.Mesh(heartGeo, red); miniHeart.scale.setScalar(0.045);
  addFloater(miniHeart, new THREE.Vector3(-5.5, 4.6, -6), 0.9, 0.25, [-0.66, 0.48, -4]);
  const miniHeart2 = new THREE.Mesh(heartGeo, ink); miniHeart2.scale.setScalar(0.035);
  addFloater(miniHeart2, new THREE.Vector3(1.2, -3.2, -3.5), 0.75, 0.25, null);

  /* ---- Раскладка под размер экрана ---- */
  const HEART_H = 4.05; // высота сердца в мировых единицах при масштабе группы 1
  let layout = { x: 2.9, y: 0.5, s: 1 };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const mobile = w < 900;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (mobile) {
      // сердце в верхней свободной зоне первого экрана
      const topFree = Math.max(0.2, (document.querySelector('.hero__eyebrow')?.getBoundingClientRect().top - canvas.getBoundingClientRect().top) / h);
      const cy = topFree * 0.55;
      layout = { x: halfW * 0.1, y: (1 - 2 * cy) * halfH, s: Math.min(0.8, (topFree * 0.6 * 2 * halfH) / HEART_H) };
    } else {
      layout = { x: 2.9, y: 0.5, s: 1 };
    }
    floaters.forEach(f => {
      const u = f.userData;
      if (!mobile) { f.visible = true; u.layoutBase = u.base.clone(); return; }
      f.visible = !!u.m;
      if (u.m) u.layoutBase = new THREE.Vector3(u.m[0] * halfW, u.m[1] * halfH, u.m[2]);
    });
  };
  resize();
  addEventListener('resize', resize);

  /* ---- Мышь, скролл, появление ---- */
  const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
  addEventListener('pointermove', e => {
    mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  });

  const intro = { v: 0 };
  const startIntro = () => {
    if (window.gsap) window.gsap.to(intro, { v: 1, duration: reduced ? 0.01 : 2.2, ease: 'expo.out' });
    else intro.v = 1;
  };
  addEventListener('amora:ready', startIntro, { once: true });
  setTimeout(() => { if (intro.v === 0) startIntro(); }, 5000);

  // Клик по сердцу — «удар»
  let pulse = 0;
  const raycaster = new THREE.Raycaster();
  const hero = canvas.parentElement;
  hero.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(p, camera);
    if (raycaster.intersectObject(heart).length) pulse = 1;
  });

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 }).observe(hero);

  const clock = new THREE.Clock();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const scrollP = Math.min(1, scrollY / innerHeight);

    smooth.lerp(mouse, 0.05);
    pulse *= 0.9;

    const beat = reduced ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.6)), 12) * 0.035;
    const s = layout.s * (0.4 + intro.v * 0.6) * (1 + beat + pulse * 0.12);
    heartGroup.scale.setScalar(s);
    heartGroup.position.set(
      layout.x + smooth.x * 0.6 - scrollP * 1.5,
      layout.y - smooth.y * 0.5 + (1 - intro.v) * -3 + scrollP * 2.2,
      scrollP * -2
    );
    const spin = reduced ? 0 : t * 0.35;
    heartGroup.rotation.set(
      smooth.y * 0.5 + Math.sin(t * 0.6) * 0.08 + scrollP * 0.6,
      spin + smooth.x * 0.9 + (1 - intro.v) * -2.5 + scrollP * 2.5,
      Math.sin(t * 0.4) * 0.06
    );

    floaters.forEach((f, i) => {
      const u = f.userData;
      const b = u.layoutBase || u.base;
      const k = reduced ? 0 : 1;
      f.position.set(
        b.x + Math.sin(t * u.speed + u.phase) * u.amp * k - smooth.x * (0.4 + i * 0.15),
        b.y + Math.cos(t * u.speed * 0.9 + u.phase) * u.amp * k + smooth.y * (0.4 + i * 0.12) + scrollP * (1.5 + i * 0.5),
        b.z
      );
      f.rotation.x += 0.004 * u.rot.x * 2 * k;
      f.rotation.y += 0.006 * u.rot.y * 2 * k;
      const fs = intro.v;
      if (!f.userData.baseScale) f.userData.baseScale = f.scale.x;
      f.scale.setScalar(f.userData.baseScale * fs);
    });

    renderer.render(scene, camera);
  };
  tick();

  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.2s ease';
  requestAnimationFrame(() => (canvas.style.opacity = '1'));
}
