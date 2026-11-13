import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { getExhibitFullImageUrl, getExhibitName } from '../utils/exhibitFields';

function plainText(html = '') {
  const documentNode = new DOMParser().parseFromString(String(html), 'text/html');
  return documentNode.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function labelTexture(text, width = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f7f4ee';
  context.fillRect(0, 0, width, 160);
  context.fillStyle = '#243342';
  context.font = 'bold 50px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let value = String(text || '未命名展品');
  while (context.measureText(value).width > width - 80 && value.length > 2) value = `${value.slice(0, -2)}…`;
  context.fillText(value, width / 2, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePanel(scene, exhibit, x, z, side, selectable, loader) {
  const name = getExhibitName(exhibit) || '未命名展品';
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.75, 2.2, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x8b6a43, roughness: 0.8 }),
  );
  frame.position.set(x, 2.25, z);
  frame.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  scene.add(frame);

  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(2.48, 1.72),
    new THREE.MeshBasicMaterial({ color: 0xe7e4dc, side: THREE.DoubleSide }),
  );
  image.position.set(x + (side === 'left' ? 0.075 : -0.075), 2.42, z);
  image.rotation.y = frame.rotation.y;
  image.userData.exhibit = exhibit;
  scene.add(image);
  selectable.push(image);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.39),
    new THREE.MeshBasicMaterial({ map: labelTexture(name), side: THREE.DoubleSide }),
  );
  label.position.set(x + (side === 'left' ? 0.085 : -0.085), 1.34, z);
  label.rotation.y = frame.rotation.y;
  label.userData.exhibit = exhibit;
  scene.add(label);
  selectable.push(label);

  const url = getExhibitFullImageUrl(exhibit);
  if (url) {
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      if (image.material) {
        image.material.map = texture;
        image.material.color.set(0xffffff);
        image.material.needsUpdate = true;
      } else {
        texture.dispose();
      }
    }, undefined, () => {});
  }
}

export function GalleryPreview({ title, sections, onClose, theme }) {
  const canvasHost = useRef(null);
  const vrHost = useRef(null);
  const [unitIndex, setUnitIndex] = useState(0);
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [vrSupported, setVrSupported] = useState(false);
  const units = useMemo(() => sections.filter((section) => section.id !== 'preface' && section.id !== 'epilogue'), [sections]);
  const unit = units[unitIndex];

  useEffect(() => {
    let active = true;
    if (navigator.xr?.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (active) setVrSupported(supported);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setSelectedExhibit(null);
    const host = canvasHost.current;
    if (!host || !unit) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xece9e3);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const exhibits = unit.exhibits || [];
    const depth = Math.max(15, Math.ceil(exhibits.length / 2) * 3.7 + 6);
    camera.position.set(1.3, 2.15, depth / 2 - 1.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-3.5, 2.1, depth / 2 - 5);
    controls.enableDamping = true;
    controls.maxDistance = depth;
    controls.minDistance = 2;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbab0a1, 2.2));
    const ceilingLight = new THREE.DirectionalLight(0xffffff, 2.3);
    ceilingLight.position.set(0, 7, 3);
    scene.add(ceilingLight);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f0e7, roughness: 1 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xc1ae94, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, depth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(depth, 5), wallMaterial);
      wall.position.set(side * 5, 2.5, 0);
      wall.rotation.y = side * Math.PI / 2;
      scene.add(wall);
    }
    for (const z of [-depth / 2, depth / 2]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallMaterial);
      wall.position.set(0, 2.5, z);
      if (z < 0) wall.rotation.y = Math.PI;
      scene.add(wall);
    }

    const heading = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 0.85),
      new THREE.MeshBasicMaterial({ map: labelTexture(unit.title, 1024), side: THREE.DoubleSide }),
    );
    heading.position.set(0, 3.65, -depth / 2 + 0.06);
    scene.add(heading);

    const selectable = [];
    const loader = new THREE.TextureLoader();
    exhibits.forEach((exhibit, index) => {
      const side = index % 2 === 0 ? 'left' : 'right';
      const z = depth / 2 - 4 - Math.floor(index / 2) * 3.7;
      makePanel(scene, exhibit, side === 'left' ? -4.91 : 4.91, z, side, selectable, loader);
    });

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
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    if (vrSupported && vrHost.current) {
      const button = VRButton.createButton(renderer);
      button.style.position = 'static';
      button.style.width = '100%';
      button.style.margin = '0';
      button.style.borderRadius = '10px';
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
        materials.forEach((material) => {
          material?.map?.dispose();
          material?.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
      vrHost.current?.replaceChildren();
    };
  }, [unit, vrSupported]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const textColor = theme.textPrimary;
  return (
    <div role="dialog" aria-modal="true" aria-label="展厅预览" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(18, 29, 38, 0.72)', padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 'min(1440px, 100%)', height: 'min(850px, 100%)', background: theme.bgPrimary, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: textColor }}>
        <header style={{ padding: '16px 22px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div><strong style={{ fontSize: 18 }}>{title} · 展厅预览</strong><div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>概念展示，用于检查单元顺序与展品组合，不代表实际展厅尺寸</div></div>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: textColor, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>关闭预览</button>
        </header>
        {unit ? (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)' }}>
            <div style={{ position: 'relative', minHeight: 0, background: '#ece9e3' }}>
              <div ref={canvasHost} style={{ width: '100%', height: '100%' }} />
              <div style={{ position: 'absolute', left: 16, bottom: 16, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,.9)', color: '#263442', fontSize: 12 }}>拖动查看 · 滚轮缩放 · 点击展品查看资料</div>
            </div>
            <aside style={{ padding: 20, overflowY: 'auto', borderLeft: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 12, color: theme.textSecondary }}>单元 {unitIndex + 1} / {units.length}</div>
              <h2 style={{ fontSize: 19, margin: '8px 0 10px' }}>{unit.title}</h2>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: theme.textSecondary }}>{plainText(unit.content).slice(0, 230) || '该单元暂无说明文字。'}</p>
              <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
                <button type="button" disabled={unitIndex === 0} onClick={() => setUnitIndex(unitIndex - 1)} style={{ flex: 1, padding: 9, cursor: 'pointer' }}>上一单元</button>
                <button type="button" disabled={unitIndex >= units.length - 1} onClick={() => setUnitIndex(unitIndex + 1)} style={{ flex: 1, padding: 9, cursor: 'pointer' }}>下一单元</button>
              </div>
              {vrSupported ? <div ref={vrHost} style={{ marginBottom: 16 }} /> : <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>支持 WebXR 的设备可进入沉浸式 VR 预览。</div>}
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>{(unit.exhibits || []).length} 件展品 · 展墙随数量扩展</div>
              {(unit.exhibits || []).map((exhibit, index) => (
                <button key={`${getExhibitName(exhibit)}-${index}`} type="button" onClick={() => setSelectedExhibit(exhibit)} style={{ width: '100%', display: 'flex', textAlign: 'left', gap: 9, padding: 8, marginBottom: 6, background: selectedExhibit === exhibit ? theme.aiGenerated : theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: 10, color: textColor, cursor: 'pointer' }}>
                  {getExhibitFullImageUrl(exhibit) && <img src={getExhibitFullImageUrl(exhibit)} alt="" style={{ width: 42, height: 42, borderRadius: 5, objectFit: 'cover' }} />}
                  <span style={{ alignSelf: 'center', fontSize: 13 }}>{getExhibitName(exhibit) || '未命名展品'}</span>
                </button>
              ))}
              {selectedExhibit && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: theme.bgSecondary, fontSize: 13, lineHeight: 1.7 }}><strong>{getExhibitName(selectedExhibit)}</strong><div>{selectedExhibit.introduction || selectedExhibit.description || selectedExhibit['介绍'] || '暂无展品介绍'}</div></div>}
            </aside>
          </div>
        ) : <div style={{ padding: 32 }}>当前大纲还没有正文单元，完成单元结构后即可预览展厅。</div>}
      </div>
    </div>
  );
}
