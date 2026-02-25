let container = document.getElementById('container');
let autoRotate = true;
let currentSceneIndex = 0;
let scenes = [];
let scene3D, camera, renderer, controls, sphereMesh, pathsGroup;

/* تحميل بيانات الجولة */
fetch('tour-data.json')
    .then(res => res.json())
    .then(data => {
        scenes = data;
        init();
        loadScene(currentSceneIndex);
        animate();
        buildSceneListPanel();
    });

function init() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene3D.add(ambientLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 0, 0);

    pathsGroup = new THREE.Group();
    scene3D.add(pathsGroup);

    document.getElementById('autoRotateBtn').onclick = () => {
        autoRotate = !autoRotate;
        controls.autoRotate = autoRotate;
        document.getElementById('autoRotateBtn').textContent =
            autoRotate ? '⏸️ إيقاف الدوران' : '▶️ تشغيل الدوران';
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

/* تحميل مشهد */
function loadScene(index) {
    const sceneData = scenes[index];
    if (!sceneData) return;

    currentSceneIndex = index;

    if (sphereMesh) scene3D.remove(sphereMesh);
    document.querySelectorAll('.hotspot').forEach(el => el.remove());
    pathsGroup.clear();

    new THREE.TextureLoader().load(sceneData.texture, texture => {
        const geometry = new THREE.SphereGeometry(500, 128, 128);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        sphereMesh = new THREE.Mesh(geometry, material);
        scene3D.add(sphereMesh);

        /* تحميل المسارات */
        if (sceneData.paths && sceneData.paths.length) {
            sceneData.paths.forEach(pathData => {
                const points = pathData.points.map(
                    p => new THREE.Vector3(p.x, p.y, p.z)
                );

                for (let i = 0; i < points.length - 1; i++) {
                    const start = points[i];
                    const end = points[i + 1];
                    const dir = new THREE.Vector3().subVectors(end, start);
                    const dist = dir.length();
                    if (dist < 0.1) continue;

                    const cyl = new THREE.Mesh(
                        new THREE.CylinderGeometry(3.5, 3.5, dist, 12),
                        new THREE.MeshStandardMaterial({
                            color: pathData.color,
                            emissive: pathData.color,
                            emissiveIntensity: 0.3
                        })
                    );

                    const q = new THREE.Quaternion();
                    q.setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        dir.clone().normalize()
                    );
                    cyl.applyQuaternion(q);
                    cyl.position.copy(
                        new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
                    );

                    cyl.visible = true;
                    cyl.userData.pathId = pathData.id;
                    pathsGroup.add(cyl);
                }
            });

            buildPathTogglePanel();
        }

        /* تحميل الـ Hotspots */
        if (sceneData.hotspots && sceneData.hotspots.length) {
            sceneData.hotspots.forEach(h => createHotspotElement(h));
        }
    });
}

/* إنشاء عنصر Hotspot */
function createHotspotElement(h) {
    const div = document.createElement('div');
    div.className = 'hotspot';
    div.style.color = h.color || '#ffffff';
    div.innerHTML = `<span class="hotspot-icon">${h.type === 'SCENE' ? '🚪' : 'ℹ️'}</span>`;

    /* Tooltip آمن */
    if (h.data && (h.data.title || h.data.text || h.data.image)) {
        const tooltip = document.createElement('div');
        tooltip.className = 'hotspot-tooltip';
        tooltip.innerHTML = `<strong>${h.data.title || ''}</strong><br>${h.data.text || ''}`;

        if (h.data.image) {
            tooltip.innerHTML += `<br><img src="${h.data.image}" style="width:100%;border-radius:5px;margin-top:5px;">`;
        }
        div.appendChild(tooltip);
    }

    /* التنقل بين المشاهد */
    div.onclick = () => {
        if (h.type === 'SCENE' && h.targetSceneId) {
            const idx = scenes.findIndex(s => s.id === h.targetSceneId);
            if (idx !== -1) loadScene(idx);
        }
    };

    container.appendChild(div);

    function updatePosition() {
        const vector = new THREE.Vector3(
            h.position.x,
            h.position.y,
            h.position.z
        ).project(camera);

        div.style.left = ((vector.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        div.style.top = ((-vector.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }

    function animateHotspot() {
        updatePosition();
        requestAnimationFrame(animateHotspot);
    }

    animateHotspot();
}

/* قائمة المشاهد */
function buildSceneListPanel() {
    const panel = document.getElementById('sceneListPanel');
    panel.innerHTML = `<strong>المشاهد</strong><br>`;

    scenes.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.textContent = s.name || `مشهد ${i + 1}`;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.margin = '5px 0';
        btn.onclick = () => loadScene(i);
        panel.appendChild(btn);
    });
}

/* قائمة إظهار / إخفاء المسارات */
function buildPathTogglePanel() {
    const panel = document.getElementById('pathTogglePanel');
    panel.innerHTML = `<strong>المسارات</strong><br>`;

    pathsGroup.children.forEach((p, i) => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" checked data-index="${i}"> ${i + 1}`;

        const input = label.querySelector('input');
        input.onchange = e => {
            const idx = parseInt(e.target.dataset.index);
            pathsGroup.children[idx].visible = e.target.checked;
        };

        panel.appendChild(label);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene3D, camera);
}