import { Component, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, OnInit, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductDataService, ProductListItem, ProductModel3D } from '../../services/product-data.service';
import { forkJoin, map, switchMap } from 'rxjs';

declare const THREE: any;

@Component({
    selector: 'app-ar-viewer',
    standalone: true,
    imports: [CommonModule, DecimalPipe, FormsModule, NgFor],
    templateUrl: './ar-viewer.html',
    styleUrl: './ar-viewer.css',
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ArViewer implements OnInit, AfterViewInit {
    private productService = inject(ProductDataService);
    
    activeFilter = 'all';
    isLoading = signal(true);
    products: any[] = [];
    categories: { name: string, slug: string }[] = [];

    get filteredProducts() {
        return this.activeFilter === 'all'
            ? this.products
            : this.products.filter(p => p.categorySlug === this.activeFilter);
    }

    get rd_filteredProducts() {
        if (!this.rd_searchTerm && this.rd_activeCategory === 'All') return this.products;
        return this.products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(this.rd_searchTerm.toLowerCase());
            const matchCat = this.rd_activeCategory === 'All' || p.categorySlug === this.rd_activeCategory || p.category === this.rd_activeCategory;
            return matchSearch && matchCat;
        });
    }

    setFilter(cat: string) {
        this.activeFilter = cat;
    }

    // --- 3D Room Designer State ---
    @ViewChild('rdCanvas') rdCanvas!: ElementRef<HTMLCanvasElement>;
    private renderer: any;
    private scene: any;
    private camera: any;
    private roomGroup: any;
    private ambientLight: any;
    private dirLight: any;
    private placedObjects: any[] = [];
    public selectedObj: any = null;
    public rd_roomW = 6;
    public rd_roomL = 5;
    public rd_roomH = 2.8;
    public rd_activeCategory = 'All';
    public rd_searchTerm = '';
    public rd_viewMode = 'perspective';
    
    // Designer Interaction
    private isDragging = false;
    private isOrbiting = false;
    private dragPlane: any;
    private dragOffset: any;
    private orbitStart = { x: 0, y: 0 };
    private orbitAngles = { theta: Math.PI/4, phi: Math.PI/4 };
    private orbitRadius = 10;
    private orbitTarget: any;
    private raycaster: any;
    private mouse: any;
    private outlineMesh: any;

    ngOnInit() {
        this.loadProductsWithModels();
    }

    loadProductsWithModels() {
        this.isLoading.set(true);
        this.productService.getAllProductModels().subscribe({
            next: (models) => {
                if (models && models.length > 0) {
                    const categoryMap = new Map<string, string>();
                    
                    this.products = models.map(m => {
                        const p = m.product_id;
                        if (!p) return null;

                        const catName = p.category_id?.name || 'Sản phẩm';
                        const catSlug = p.category_id?.slug || 'other';
                        
                        // Collect unique categories
                        if (p.category_id?._id) {
                            categoryMap.set(catSlug, catName);
                        }

                        return {
                            id: m._id,
                            name: p.name || 'Sản phẩm',
                            category: catName,
                            categorySlug: catSlug,
                            desc: p.materialText || 'Khám phá sản phẩm trong không gian 3D.',
                            price: p.price || p.min_price || 0,
                            dims: p.sizeText || 'Đang cập nhật',
                            src: this.productService.getModelFileUrl(m.file_id),
                            poster: p.thumbnail?.trim() || p.thumbnail_url?.trim() || 'https://via.placeholder.com/600x400',
                            colors: []
                        };
                    }).filter(item => item !== null);

                    this.categories = Array.from(categoryMap.entries()).map(([slug, name]) => ({ name, slug }));
                } else {
                    console.warn("Không tìm thấy model nào trong DB. Đang hiển thị dữ liệu mẫu.");
                    this.useDummyData();
                }
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error("Lỗi khi tải dữ liệu AR:", err);
                this.useDummyData();
                this.isLoading.set(false);
            }
        });
    }

    private useDummyData() {
        this.products = [
            {
                id: 'dummy-1', category: 'sofa',
                name: 'Sofa Da Ý Premium (Demo)',
                desc: 'Da bò thật 100%, khung gỗ sồi tự nhiên, đệm cao su non cao cấp.',
                price: 25900000,
                dims: 'W240 × D95 × H85 cm',
                src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
                poster: 'https://via.placeholder.com/600x400/f8f8f8/434343?text=Sofa+Da+Ý',
                colors: ['#6b4c35', '#1a1612', '#8a7d72', '#EF683A']
            }
        ];
    }

    ngAfterViewInit() {
        // Load model-viewer script dynamically
        if (!document.querySelector('script[src*="model-viewer"]')) {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
            document.head.appendChild(script);
        }

        this.initRoomDesigner();
    }

    async initRoomDesigner() {
        await this.loadThreeJS();
        this.setupRDScene();
        this.animateRD();
    }

    private loadThreeJS(): Promise<void> {
        return new Promise((resolve) => {
            if ((window as any)['THREE'] && (window as any)['THREE'].GLTFLoader) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => {
                const loaderScript = document.createElement('script');
                loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
                loaderScript.onload = () => resolve();
                document.head.appendChild(loaderScript);
            };
            document.head.appendChild(script);
        });
    }

    private setupRDScene() {
        const canvas = this.rdCanvas.nativeElement;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.setClearColor(0x1a1a24);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x1a1a24, 20, 50);

        this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        this.orbitTarget = new THREE.Vector3(0, 1, 0);
        this.updateCameraOrbit();

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(5, 10, 5);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);

        this.roomGroup = new THREE.Group();
        this.scene.add(this.roomGroup);
        this.buildRDRoom();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
        this.dragOffset = new THREE.Vector3();

        this.addCanvasListeners();
        this.onRDResize();
        window.addEventListener('resize', () => this.onRDResize());
    }

    public buildRDRoom() {
        if (!this.roomGroup) return;
        while(this.roomGroup.children.length > 0) this.roomGroup.remove(this.roomGroup.children[0]);

        const floorGeo = new THREE.PlaneGeometry(this.rd_roomW, this.rd_roomL);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4c4a8, side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.roomGroup.add(floor);

        const gridHelper = new THREE.GridHelper(Math.max(this.rd_roomW, this.rd_roomL), Math.max(this.rd_roomW, this.rd_roomL) * 2, 0xb0a090, 0xb0a090);
        gridHelper.position.y = 0.001;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.roomGroup.add(gridHelper);

        const wallMat = new THREE.MeshLambertMaterial({ color: 0xf0ebe0 });
        const wallThick = 0.1;

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(this.rd_roomW, this.rd_roomH, wallThick), wallMat);
        backWall.position.set(0, this.rd_roomH/2, -this.rd_roomL/2);
        this.roomGroup.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, this.rd_roomH, this.rd_roomL), wallMat);
        leftWall.position.set(-this.rd_roomW/2, this.rd_roomH/2, 0);
        this.roomGroup.add(leftWall);
    }

    public addRDFurniture(product: any) {
        if (!product.src) return;

        const loader = new (THREE as any).GLTFLoader();
        
        loader.load(product.src, (gltf: any) => {
            const model = gltf.scene;
            
            // Normalize size
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.0 / maxDim; // Scale to ~1m
            model.scale.set(scale, scale, scale);
            
            // Center bottom
            const newBox = new THREE.Box3().setFromObject(model);
            const center = newBox.getCenter(new THREE.Vector3());
            model.position.x = -center.x;
            model.position.y = -newBox.min.y;
            model.position.z = -center.z;

            // Wrapper to handle pivot/rotation easily
            const wrapper = new THREE.Group();
            wrapper.add(model);
            wrapper.position.set(0, 0, 0);
            
            this.scene.add(wrapper);

            const obj = { 
                mesh: wrapper, 
                product, 
                id: Date.now(), 
                name: product.name, 
                rotY: 0,
                dims: { w: 1, h: 1, d: 1 } // Approximated
            };
            
            this.placedObjects.push(obj);
            this.selectRDObject(obj);
        }, 
        (xhr: any) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error: any) => {
            console.error('Lỗi khi load model 3D:', error);
        });
    }

    public selectRDObject(obj: any) {
        if (this.outlineMesh) { this.scene.remove(this.outlineMesh); this.outlineMesh = null; }
        this.selectedObj = obj;

        if (obj) {
            const geo = new THREE.BoxGeometry(obj.dims.w + 0.06, obj.dims.h + 0.06, obj.dims.d + 0.06);
            this.outlineMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc8f064, wireframe: true, transparent: true, opacity: 0.6 }));
            this.outlineMesh.position.copy(obj.mesh.position);
            this.outlineMesh.rotation.copy(obj.mesh.rotation);
            this.scene.add(this.outlineMesh);
        }
    }

    public deleteSelectedRD() {
        if (!this.selectedObj) return;
        this.scene.remove(this.selectedObj.mesh);
        if (this.outlineMesh) { this.scene.remove(this.outlineMesh); this.outlineMesh = null; }
        this.placedObjects = this.placedObjects.filter(o => o !== this.selectedObj);
        this.selectedObj = null;
    }

    public rotateRDSelected(deg: number) {
        if (!this.selectedObj) return;
        const rad = deg * Math.PI / 180;
        this.selectedObj.mesh.rotation.y = rad;
        this.selectedObj.rotY = rad;
        if (this.outlineMesh) this.outlineMesh.rotation.y = rad;
    }

    private updateCameraOrbit() {
        if (!this.camera) return;
        this.camera.position.x = this.orbitTarget.x + this.orbitRadius * Math.sin(this.orbitAngles.theta) * Math.cos(this.orbitAngles.phi);
        this.camera.position.y = this.orbitTarget.y + this.orbitRadius * Math.sin(this.orbitAngles.phi);
        this.camera.position.z = this.orbitTarget.z + this.orbitRadius * Math.cos(this.orbitAngles.theta) * Math.cos(this.orbitAngles.phi);
        this.camera.lookAt(this.orbitTarget);
    }

    private addCanvasListeners() {
        const canvas = this.rdCanvas.nativeElement;
        
        canvas.onmousedown = (e: any) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);

            const hits = this.raycaster.intersectObjects(this.placedObjects.map(o => o.mesh), true);
            if (hits.length > 0) {
                let hitMesh = hits[0].object;
                while (hitMesh.parent && !this.placedObjects.find(o => o.mesh === hitMesh)) hitMesh = hitMesh.parent;
                const obj = this.placedObjects.find(o => o.mesh === hitMesh);
                if (obj) {
                    this.selectRDObject(obj);
                    this.isDragging = true;
                    this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), hitMesh.position);
                    const pt = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(this.dragPlane, pt);
                    this.dragOffset.subVectors(hitMesh.position, pt);
                    return;
                }
            }
            this.isOrbiting = true;
            this.orbitStart = { x: e.clientX, y: e.clientY };
            this.selectRDObject(null);
        };

        window.onmousemove = (e: any) => {
            if (this.isDragging && this.selectedObj) {
                const rect = canvas.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const pt = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, pt);
                pt.add(this.dragOffset);
                pt.y = this.selectedObj.dims.h / 2;
                this.selectedObj.mesh.position.copy(pt);
                if (this.outlineMesh) this.outlineMesh.position.copy(pt);
            } else if (this.isOrbiting) {
                const dx = e.clientX - this.orbitStart.x;
                const dy = e.clientY - this.orbitStart.y;
                this.orbitAngles.theta -= dx * 0.005;
                this.orbitAngles.phi = Math.max(0.1, Math.min(Math.PI/2 - 0.05, this.orbitAngles.phi - dy * 0.005));
                this.orbitStart = { x: e.clientX, y: e.clientY };
                this.updateCameraOrbit();
            }
        };

        window.onmouseup = () => { this.isDragging = false; this.isOrbiting = false; };
        
        canvas.onwheel = (e: WheelEvent) => {
            this.orbitRadius = Math.max(3, Math.min(25, this.orbitRadius + e.deltaY * 0.02));
            this.updateCameraOrbit();
            e.preventDefault();
        };
    }

    private onRDResize() {
        if (!this.camera || !this.renderer) return;
        const canvas = this.rdCanvas.nativeElement;
        const width = canvas.parentElement?.clientWidth || 0;
        const height = 600;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    private animateRD() {
        requestAnimationFrame(() => this.animateRD());
        this.renderer.render(this.scene, this.camera);
    }

    public setRDView(mode: string) {
        this.rd_viewMode = mode;
        if (mode === 'perspective') { this.orbitAngles = { theta: Math.PI/4, phi: Math.PI/4 }; this.orbitRadius = 10; }
        else if (mode === 'top') { this.orbitAngles = { theta: 0, phi: Math.PI/2 - 0.01 }; this.orbitRadius = 12; }
        this.updateCameraOrbit();
    }

    public clearRDRoom() {
        this.placedObjects.forEach(o => this.scene.remove(o.mesh));
        this.placedObjects = [];
        this.selectRDObject(null);
    }

    launchAR(id: string | number) {
        const mv = document.getElementById(`mv-${id}`) as any;
        if (mv?.activateAR) mv.activateAR();
    }

    trackById(_: number, item: any) { return item.id; }
}
