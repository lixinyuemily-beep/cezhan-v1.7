import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { getExhibitFullImageUrl, getExhibitName } from '../utils/exhibitFields';

function plainText(html = '') {
  const node = new DOMParser().parseFromString(String(html), 'text/html');
  return node.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function projectColorOffset(title) {
  let value = 0;
  for (const character of String(title || '')) value = (value * 31 + character.codePointAt(0)) >>> 0;
  return value % 4;
}

function wrapLines(context, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const character of String(text || '')) {
    if (context.measureText(line + character).width > maxWidth && line) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines - 1) break;
    } else line += character;
  }
  const consumed = lines.join('').length;
  let remainder = String(text || '').slice(consumed);
  while (context.measureText(remainder).width > maxWidth && remainder.length > 1) remainder = `${remainder.slice(0, -2)}…`;
  if (remainder) lines.push(remainder);
  return lines;
}

function textTexture({ title, body, width = 1024, height = 512, accent = '#557c86', titleSize = 52, bodySize = 29 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f9f7f2';
  context.fillRect(0, 0, width, height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 16, height);
  context.textBaseline = 'top';
  context.fillStyle = '#263b48';
  context.font = `bold ${titleSize}px sans-serif`;
  wrapLines(context, title, width - 100, 2).forEach((line, index) => context.fillText(line, 54, 40 + index * (titleSize + 13)));
  if (body) {
    context.fillStyle = '#56616a';
    context.font = `${bodySize}px sans-serif`;
    const bodyTop = 40 + 2 * (titleSize + 13) + 20;
    const maxLines = Math.max(1, Math.floor((height - bodyTop - 30) / (bodySize + 15)));
    wrapLines(context, body, width - 108, maxLines).forEach((line, index) => context.fillText(line, 54, bodyTop + index * (bodySize + 15)));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addTextPanel(scene, options, x, z, side, width, height, y) {
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: textTexture(options), side: THREE.DoubleSide }),
  );
  panel.position.set(x, y, z);
  panel.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  scene.add(panel);
  return panel;
}

function addExhibit(scene, exhibit, x, z, side, loader, selectable) {
  const facing = side === 'left' ? 1 : -1;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.82, 1.72), new THREE.MeshStandardMaterial({ color: 0x8c755e, roughness: 0.8 }));
  frame.position.set(x, 2.28, z);
  scene.add(frame);
  const image = new THREE.Mesh(new THREE.PlaneGeometry(1.57, 1.58), new THREE.MeshBasicMaterial({ color: 0xe9e5dc, side: THREE.DoubleSide }));
  image.position.set(x + facing * 0.065, 2.33, z);
  image.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  image.userData.exhibit = exhibit;
  scene.add(image);
  selectable.push(image);
  const caption = addTextPanel(scene, { title: getExhibitName(exhibit) || '未命名展品', body: plainText(exhibit.introduction || exhibit.description || exhibit['介绍']).slice(0, 90), height: 290, titleSize: 47, bodySize: 26 }, x + facing * 0.07, z, side, 1.73, 0.7, 1.02);
  caption.userData.exhibit = exhibit;
  selectable.push(caption);
  const url = getExhibitFullImageUrl(exhibit);
  if (url) loader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    if (!image.material) { texture.dispose(); return; }
    image.material.map = texture;
    image.material.color.set(0xffffff);
    image.material.needsUpdate = true;
  }, undefined, () => {});
}

export function GalleryPreview({ title, sections, onClose, theme }) {
  const canvasHost = useRef(null);
  const vrHost = useRef(null);
  const focusUnit = useRef(null);
  const focusExhibit = useRef(null);
  const [unitIndex, setUnitIndex] = useState(0);
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [vrSupported, setVrSupported] = useState(false);
  const units = useMemo(() => sections.filter((section) => section.id !== 'preface' && section.id !== 'epilogue'), [sections]);
  const unit = units[unitIndex];

  useEffect(() => {
    let active = true;
    navigator.xr?.isSessionSupported?.('immersive-vr').then((supported) => { if (active) setVrSupported(supported); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host || !units.length) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xece9e3);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
    const roomWidth = 10;
    const laneGap = 3.05;
    const unitLengths = units.map((entry) => Math.max(8.2, Math.ceil((entry.exhibits || []).length / 2) * laneGap + 4.1));
    const totalDepth = Math.max(17, unitLengths.reduce((sum, length) => sum + length, 0) + 4);
    const colorOffset = projectColorOffset(title);
    const locations = [];
    const selectable = [];
    const loader = new THREE.TextureLoader();
    let cursor = totalDepth / 2 - 2.2;
    units.forEach((entry, index) => {
      const length = unitLengths[index];
      const start = cursor;
      const end = cursor - length;
      const accent = ['#597f87', '#967352', '#677b67', '#7c7393'][(index + colorOffset) % 4];
      const exhibits = entry.exhibits || [];
      const pairs = Math.ceil(exhibits.length / 2);
      const firstExhibitZ = start - 3.65;
      locations.push({ start, end, firstExhibitZ, accent });
      for (const side of ['left', 'right']) {
        const wallX = side === 'left' ? -roomWidth / 2 + 0.07 : roomWidth / 2 - 0.07;
        addTextPanel(scene, { title: entry.title, body: plainText(entry.content).slice(0, 280) || '本单元展示策展方案中的展品与叙事线索。', accent, titleSize: 47, bodySize: 27 }, wallX, start - 1.38, side, 4.15, 1.9, 2.55);
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, length - 0.6), new THREE.MeshBasicMaterial({ color: accent }));
        marker.position.set(wallX, 0.12, (start + end) / 2);
        scene.add(marker);
      }
      exhibits.forEach((exhibit, exhibitIndex) => {
        const side = exhibitIndex % 2 === 0 ? 'left' : 'right';
        const z = firstExhibitZ - Math.floor(exhibitIndex / 2) * laneGap;
        addExhibit(scene, exhibit, side === 'left' ? -roomWidth / 2 + 0.14 : roomWidth / 2 - 0.14, z, side, loader, selectable);
      });
      if (!pairs) {
        const note = addTextPanel(scene, { title: '展品待配置', body: '确认展品后将在此显示陈列预览。', accent, titleSize: 48 }, -roomWidth / 2 + 0.09, start - 4.3, 'left', 2.2, 1.0, 2.25);
        note.userData.unitIndex = index;
      }
      cursor = end;
    });
    camera.position.set(2.3, 2.25, locations[0].start - 1.9);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-4.6, 2.4, locations[0].start - 1.9);
    controls.enableDamping = true;
    controls.minDistance = 1.5;
    controls.maxDistance = Math.max(30, totalDepth);
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbab0a1, 2.2));
    const ceilingLight = new THREE.DirectionalLight(0xffffff, 2.3);
    ceilingLight.position.set(0, 7, 3);
    scene.add(ceilingLight);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf1ede5, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, totalDepth), new THREE.MeshStandardMaterial({ color: 0xc8b8a2, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, totalDepth), new THREE.MeshBasicMaterial({ color: 0xf4f1eb, side: THREE.DoubleSide }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    scene.add(ceiling);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(totalDepth, 5), wallMaterial);
      wall.position.set(side * roomWidth / 2, 2.5, 0);
      wall.rotation.y = side * Math.PI / 2;
      scene.add(wall);
    }
    for (const z of [-totalDepth / 2, totalDepth / 2]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 5), wallMaterial);
      wall.position.set(0, 2.5, z);
      if (z < 0) wall.rotation.y = Math.PI;
      scene.add(wall);
    }
    focusUnit.current = (index) => {
      const location = locations[index];
      if (!location) return;
      camera.position.set(2.3, 2.25, location.start - 1.9);
      controls.target.set(-4.6, 2.4, location.start - 1.9);
      controls.update();
    };
    focusExhibit.current = (unitNumber, exhibitNumber) => {
      const location = locations[unitNumber];
      if (!location) return;
      const side = exhibitNumber % 2 === 0 ? -1 : 1;
      const z = location.firstExhibitZ - Math.floor(exhibitNumber / 2) * laneGap;
      camera.position.set(side * 1.3, 2.2, z + 2.7);
      controls.target.set(side * 4.8, 2.1, z);
      controls.update();
    };
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const selectAtPointer = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(selectable)[0];
      if (hit) setSelectedExhibit(hit.object.userData.exhibit);
    };
    renderer.domElement.addEventListener('click', selectAtPointer);
    const resize = () => {
      camera.aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    if (vrSupported && vrHost.current) {
      const button = VRButton.createButton(renderer);
      Object.assign(button.style, { position: 'static', width: '100%', margin: '0', borderRadius: '10px' });
      vrHost.current.appendChild(button);
    }
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('click', selectAtPointer);
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { material?.map?.dispose(); material?.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
      vrHost.current?.replaceChildren();
      focusUnit.current = null;
      focusExhibit.current = null;
    };
  }, [title, units, vrSupported]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="展厅预览" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(18,29,38,.72)', padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 'min(1440px,100%)', height: 'min(850px,100%)', background: theme.bgPrimary, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: theme.textPrimary }}>
        <header style={{ padding: '16px 22px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div><strong style={{ fontSize: 18 }}>{title} · 展厅预览</strong><div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>根据当前大纲与展品生成的概念展厅 · 同一方案保持相同布局</div></div>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.textPrimary, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>关闭预览</button>
        </header>
        {unit ? (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,320px)' }}>
            <div style={{ position: 'relative', minHeight: 0, background: '#ece9e3' }}>
              <div ref={canvasHost} style={{ width: '100%', height: '100%' }} />
              <div style={{ position: 'absolute', left: 16, bottom: 16, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,.9)', color: '#263442', fontSize: 12 }}>拖动查看 · 滚轮缩放 · 点击展品查看资料</div>
            </div>
            <aside style={{ padding: 20, overflowY: 'auto', borderLeft: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 12, color: theme.textSecondary }}>共享展厅 · {units.length} 个单元</div>
              <div style={{ display: 'grid', gap: 6, margin: '12px 0 18px' }}>
                {units.map((entry, index) => <button key={`${entry.id}-${index}`} type="button" onClick={() => { setUnitIndex(index); setSelectedExhibit(null); focusUnit.current?.(index); }} style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: `1px solid ${theme.border}`, background: index === unitIndex ? theme.aiGenerated : theme.bgSecondary, color: theme.textPrimary, cursor: 'pointer' }}>{entry.title}</button>)}
              </div>
              <h2 style={{ fontSize: 19, margin: '8px 0 10px' }}>{unit.title}</h2>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: theme.textSecondary }}>{plainText(unit.content) || '该单元暂无说明文字。'}</p>
              {vrSupported ? <div ref={vrHost} style={{ marginBottom: 16 }} /> : <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>支持 WebXR 的设备可进入沉浸式 VR 预览。</div>}
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>{(unit.exhibits || []).length} 件展品 · 点击列表可定位展墙</div>
              {(unit.exhibits || []).map((exhibit, index) => <button key={`${getExhibitName(exhibit)}-${index}`} type="button" onClick={() => { setSelectedExhibit(exhibit); focusExhibit.current?.(unitIndex, index); }} style={{ width: '100%', display: 'flex', textAlign: 'left', gap: 9, padding: 8, marginBottom: 6, background: selectedExhibit === exhibit ? theme.aiGenerated : theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.textPrimary, cursor: 'pointer' }}>
                {getExhibitFullImageUrl(exhibit) && <img src={getExhibitFullImageUrl(exhibit)} alt="" style={{ width: 42, height: 42, borderRadius: 5, objectFit: 'cover' }} />}
                <span style={{ alignSelf: 'center', fontSize: 13 }}>{getExhibitName(exhibit) || '未命名展品'}</span>
              </button>)}
              {selectedExhibit && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: theme.bgSecondary, fontSize: 13, lineHeight: 1.7 }}><strong>{getExhibitName(selectedExhibit)}</strong><div>{selectedExhibit.introduction || selectedExhibit.description || selectedExhibit['介绍'] || '暂无展品介绍'}</div></div>}
            </aside>
          </div>
        ) : <div style={{ padding: 32 }}>当前大纲还没有正文单元，完成单元结构后即可预览展厅。</div>}
      </div>
    </div>
  );
}
