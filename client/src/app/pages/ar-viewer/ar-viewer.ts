import { Component, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

declare const document: Document;

@Component({
    selector: 'app-ar-viewer',
    imports: [CommonModule],
    templateUrl: './ar-viewer.html',
    styleUrl: './ar-viewer.css',
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ArViewer implements AfterViewInit {
    activeFilter = 'all';

    products = [
        {
            id: 1, category: 'sofa',
            name: 'Sofa Da Ý Premium',
            desc: 'Da bò thật 100%, khung gỗ sồi tự nhiên, đệm cao su non cao cấp.',
            price: '25.900.000đ',
            dims: 'W240 × D95 × H85 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/f8f8f8/434343?text=Sofa+Da+Ý',
            colors: ['#6b4c35', '#1a1612', '#8a7d72', '#EF683A']
        },
        {
            id: 2, category: 'sofa',
            name: 'Sofa Vải Boucle',
            desc: 'Chất liệu boucle Pháp mềm mại, phong cách Scandinavian hiện đại.',
            price: '18.500.000đ',
            dims: 'W210 × D90 × H78 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/efefef/434343?text=Sofa+Boucle',
            colors: ['#f5f0e8', '#d4c8b8', '#8a7d72']
        },
        {
            id: 3, category: 'chair',
            name: 'Ghế Eames Replica',
            desc: 'Thiết kế kinh điển, vỏ nhựa ABS cứng, chân thép mạ crôm sáng bóng.',
            price: '4.200.000đ',
            dims: 'W62 × D60 × H85 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/efefef/434343?text=Ghế+Eames',
            colors: ['#1a1612', '#ffffff', '#EF683A', '#6b4c35']
        },
        {
            id: 4, category: 'chair',
            name: 'Ghế Đọc Sách Wing',
            desc: 'Tựa lưng cao bọc da mềm, phù hợp góc đọc sách hoặc văn phòng tại nhà.',
            price: '8.900.000đ',
            dims: 'W80 × D85 × H110 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/efefef/434343?text=Ghế+Wing',
            colors: ['#6b4c35', '#1a1612', '#8a7d72']
        },
        {
            id: 5, category: 'table',
            name: 'Bàn Cà Phê Marble',
            desc: 'Mặt đá cẩm thạch tự nhiên, chân inox mạ vàng, phong cách luxury tối giản.',
            price: '12.500.000đ',
            dims: 'W120 × D60 × H42 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/efefef/434343?text=Bàn+Marble',
            colors: ['#ffffff', '#d4c8b8', '#1a1612']
        },
        {
            id: 6, category: 'table',
            name: 'Bàn Ăn Gỗ Walnut',
            desc: 'Gỗ óc chó Mỹ nguyên tấm, vân gỗ tự nhiên độc đáo, chân gỗ sồi.',
            price: '32.000.000đ',
            dims: 'W180 × D90 × H75 cm',
            src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
            poster: 'https://via.placeholder.com/600x400/efefef/434343?text=Bàn+Walnut',
            colors: ['#5c3d28', '#8a6040', '#EF683A']
        }
    ];

    get filteredProducts() {
        return this.activeFilter === 'all'
            ? this.products
            : this.products.filter(p => p.category === this.activeFilter);
    }

    setFilter(cat: string) {
        this.activeFilter = cat;
    }

    ngAfterViewInit() {
        // Load model-viewer script dynamically
        if (!document.querySelector('script[src*="model-viewer"]')) {
            const script = document.createElement('script');
            script.type = 'module';
            script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
            document.head.appendChild(script);
        }
    }

    launchAR(id: number) {
        const mv = document.getElementById(`mv-${id}`) as any;
        if (mv?.activateAR) mv.activateAR();
    }

    trackById(_: number, item: any) { return item.id; }
}
