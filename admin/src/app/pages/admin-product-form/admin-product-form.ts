import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

type VariantStatus = 'active' | 'inactive';
type StockStatus = 'available' | 'unavailable';

type DraftImage = {
  _id?: string;
  localId: string;
  variant_id: string | null;
  image_url: string;
  preview_url: string;
  sort_order: number;
  is_primary: boolean;
  alt_text: string;
  file: File | null;
};

type DraftVariant = {
  _id?: string;
  localId: string;
  variant_name: string;
  sku: string;
  color: string;
  price: number;
  compare_at_price: number;
  stock_quantity: number;
  status: StockStatus;
  variant_status: VariantStatus;
  sold: number;
};

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-product-form.html',
  styleUrls: ['./admin-product-form.css'],
})
export class AdminProductForm implements OnInit, AfterViewInit {
  private static readonly SAVE_CONCURRENCY = 3;
  private fb = inject(FormBuilder);
  private api = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('descriptionEditor') descriptionEditor?: ElementRef<HTMLDivElement>;
  private savedRange: Range | null = null;
  private localCounter = 0;

  isEdit = false;
  id: string | null = null;
  routeProductKey: string | null = null;
  savedProductSlug: string | null = null;
  isLoading = false;
  showImageMenu = false;

  selectedEditorImage: HTMLImageElement | null = null;
  selectedImagePercent = 100;
  isEditingImagePercent = false;
  draftImagePercent = '';
  showNewImageForm = false;

  categories: any[] = [];
  collections: any[] = [];

  images: DraftImage[] = [];
  removedImageIds = new Set<string>();
  selectedFormImageId: string | null = null;

  variants: DraftVariant[] = [];
  removedVariantIds = new Set<string>();
  showVariantModal = false;
  editingVariantIndex = -1;
  variantDraft: DraftVariant = this.createEmptyVariant();
  variantError = '';

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;
  showLeaveConfirm = false;
  private pendingLeaveResolver: ((ok: boolean) => void) | null = null;

  form = this.fb.group({
    name: ['', [Validators.required]],
    sku: [''],
    brand: [''],
    status: ['active', [Validators.required]],
    category_id: ['', [Validators.required]],
    collection_id: [''],
    product_type: [''],
    url: [''],
    short_description: [''],
    description: [''],
  });

  ngAfterViewInit(): void {
    this.syncEditorFromForm();
  }

  ngOnInit(): void {
    this.routeProductKey = this.route.snapshot.paramMap.get('slug');
    this.isEdit = !!this.routeProductKey;
    this.isLoading = true;

    const reqs: any = {
      categories: this.api.getCategories({ limit: 500 }),
      collections: this.api.getCollections({ limit: 500 }),
    };

    if (this.isEdit) {
      reqs.product = this.api.getProductById(this.routeProductKey!);
    }

    forkJoin(reqs).subscribe({
      next: (res: any) => {
        this.categories = res.categories?.items ?? res.categories ?? [];
        this.collections = res.collections?.items ?? res.collections ?? [];

        if (this.isEdit && res.product) {
          this.id = String(res.product._id || '');
          this.savedProductSlug = String(res.product.slug || '').trim() || this.routeProductKey;
          this.form.patchValue({
            name: res.product.name ?? '',
            sku: res.product.sku ?? '',
            brand: res.product.brand ?? '',
            status: res.product.status ?? 'active',
            category_id: String(res.product.category_id ?? ''),
            collection_id: String(res.product.collection_id ?? ''),
            product_type: res.product.product_type ?? '',
            url: res.product.url ?? '',
            short_description: res.product.short_description ?? '',
            description: res.product.description ?? '',
          });

          forkJoin({
            images: this.api.getImages({ product_id: this.id, limit: 500 }),
            variants: this.api.getVariants({ product_id: this.id, limit: 200 }),
          }).subscribe({
            next: (detailRes: any) => {
              const rawImages = detailRes.images?.items ?? detailRes.images ?? [];
              this.images = this.sortImages(rawImages).map((img: any) => ({
                _id: String(img._id),
                localId: this.nextLocalId('img'),
                variant_id: img.variant_id ? String(img.variant_id) : null,
                image_url: String(img.image_url || ''),
                preview_url: this.normalizeImageUrl(img.image_url),
                sort_order: Number(img.sort_order || 0),
                is_primary: !!img.is_primary,
                alt_text: String(img.alt_text || ''),
                file: null,
              }));
              this.selectedFormImageId = this.images[0]?.localId || null;

              const rawVariants = detailRes.variants?.items ?? detailRes.variants ?? [];
              this.variants = rawVariants.map((variant: any) => this.mapVariantToDraft(variant));

              if (this.routeProductKey !== res.product.slug && res.product.slug) {
                this.savedProductSlug = String(res.product.slug);
                this.router.navigate(['/admin/products', res.product.slug, 'edit'], {
                  queryParams: this.route.snapshot.queryParams,
                  replaceUrl: true,
                });
              }

              this.syncEditorFromForm();
              this.form.markAsPristine();
              this.isLoading = false;
            },
            error: () => (this.isLoading = false),
          });

          return;
        }

        this.syncEditorFromForm();
        this.form.markAsPristine();
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  private nextLocalId(prefix: string): string {
    this.localCounter += 1;
    return `${prefix}-${Date.now()}-${this.localCounter}`;
  }

  private createEmptyVariant(): DraftVariant {
    return {
      localId: this.nextLocalId('variant'),
      variant_name: '',
      sku: '',
      color: '',
      price: 0,
      compare_at_price: 0,
      stock_quantity: 0,
      status: 'available',
      variant_status: 'active',
      sold: 0,
    };
  }

  private mapVariantToDraft(variant: any): DraftVariant {
    return {
      _id: String(variant._id),
      localId: this.nextLocalId('variant'),
      variant_name: String(variant.variant_name || variant.name || ''),
      sku: String(variant.sku || ''),
      color: String(variant.color || ''),
      price: Number(variant.price || 0),
      compare_at_price: Number(variant.compare_at_price || 0),
      stock_quantity: Number(variant.stock_quantity || 0),
      status: String(variant.status || 'available').toLowerCase() === 'unavailable' ? 'unavailable' : 'available',
      variant_status: String(variant.variant_status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      sold: Number(variant.sold || 0),
    };
  }

  private sortImages(arr: any[]) {
    return [...arr].sort((a, b) => {
      if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
      const ao = Number(a.sort_order || 0);
      const bo = Number(b.sort_order || 0);
      if (ao !== bo) return ao - bo;
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return at - bt;
    });
  }

  private syncEditorFromForm(): void {
    const editor = this.descriptionEditor?.nativeElement;
    if (!editor) return;
    const html = this.form.controls.description.value ?? '';
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.form.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.image-menu')) this.showImageMenu = false;
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.form.dirty) return true;
    if (this.showLeaveConfirm) return false;
    this.showLeaveConfirm = true;
    return new Promise<boolean>((resolve) => {
      this.pendingLeaveResolver = resolve;
    });
  }

  preventToolbarFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  captureSelection(): void {
    const editor = this.descriptionEditor?.nativeElement;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.startContainer)) this.savedRange = range.cloneRange();
  }

  private restoreSelection(): void {
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (this.savedRange) selection.addRange(this.savedRange);
  }

  private focusEditor(): void {
    this.descriptionEditor?.nativeElement.focus();
  }

  private runEditorCommand(command: string, value?: string): void {
    this.focusEditor();
    this.restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    this.onDescriptionInput();
    this.captureSelection();
  }

  formatDescription(command: string): void {
    this.runEditorCommand(command);
  }

  alignDescription(command: 'justifyLeft' | 'justifyCenter' | 'justifyRight'): void {
    this.runEditorCommand(command);
  }

  formatBlock(tag: 'p' | 'h2' | 'h3' | 'blockquote'): void {
    this.runEditorCommand('formatBlock', tag);
  }

  toggleList(command: 'insertUnorderedList' | 'insertOrderedList'): void {
    this.runEditorCommand(command);
  }

  insertLink(): void {
    const url = window.prompt('Nhập liên kết');
    if (!url) return;
    this.runEditorCommand('createLink', url.trim());
  }

  clearFormatting(): void {
    this.runEditorCommand('removeFormat');
  }

  insertImageFromUrl(): void {
    this.showImageMenu = false;
    const url = window.prompt('Nhập URL ảnh');
    if (!url) return;
    this.runEditorCommand('insertImage', url.trim());
  }

  toggleImageMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showImageMenu = !this.showImageMenu;
  }

  openImagePicker(input: HTMLInputElement): void {
    this.showImageMenu = false;
    this.captureSelection();
    input.click();
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;

      this.api.uploadImage(result, this.form.controls.name.value || '').subscribe({
        next: (res: any) => {
          const imageUrl = String(res?.image_url || '').trim();
          if (imageUrl) this.runEditorCommand('insertImage', imageUrl);
        },
        error: () => alert('Không tải được ảnh. Vui lòng thử lại.'),
      });
    };

    reader.readAsDataURL(file);
    if (input) input.value = '';
  }

  onEditorClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLImageElement) {
      this.selectEditorImage(target);
      return;
    }
    this.clearSelectedEditorImage();
  }

  private selectEditorImage(image: HTMLImageElement): void {
    this.clearSelectedEditorImage();
    this.selectedEditorImage = image;
    this.selectedEditorImage.classList.add('editor-selected-image');
    const editorWidth = this.descriptionEditor?.nativeElement.clientWidth || 1;
    const imageWidth = image.getBoundingClientRect().width || editorWidth;
    const ratio = (imageWidth / editorWidth) * 100;
    this.selectedImagePercent = Math.max(10, Math.min(100, Math.round(ratio)));
  }

  private clearSelectedEditorImage(): void {
    if (this.selectedEditorImage) this.selectedEditorImage.classList.remove('editor-selected-image');
    this.selectedEditorImage = null;
    this.selectedImagePercent = 100;
    this.isEditingImagePercent = false;
    this.draftImagePercent = '';
  }

  private applySelectedImagePercent(nextPercent: number): void {
    if (!this.selectedEditorImage) return;
    const percent = Math.max(10, Math.min(100, nextPercent));
    this.selectedEditorImage.style.width = `${percent}%`;
    this.selectedEditorImage.style.maxWidth = '560px';
    this.selectedEditorImage.style.height = 'auto';
    this.selectedImagePercent = percent;
    this.onDescriptionInput();
  }

  increaseSelectedImage(): void {
    this.applySelectedImagePercent(this.selectedImagePercent + 5);
  }

  decreaseSelectedImage(): void {
    this.applySelectedImagePercent(this.selectedImagePercent - 5);
  }

  startEditImagePercent(): void {
    this.isEditingImagePercent = true;
    this.draftImagePercent = String(this.selectedImagePercent);
  }

  onPercentInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyDraftImagePercent();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEditImagePercent();
    }
  }

  applyDraftImagePercent(): void {
    const percent = Number(this.draftImagePercent || 0);
    if (!Number.isFinite(percent) || percent <= 0) {
      this.cancelEditImagePercent();
      return;
    }
    this.isEditingImagePercent = false;
    this.applySelectedImagePercent(percent);
  }

  cancelEditImagePercent(): void {
    this.isEditingImagePercent = false;
    this.draftImagePercent = String(this.selectedImagePercent);
  }

  onDescriptionInput(): void {
    const html = this.normalizeDescriptionHtml(this.descriptionEditor?.nativeElement.innerHTML ?? '');
    this.form.controls.description.setValue(html);
  }

  get liveSlug(): string {
    return this.slugify(String(this.form.value.name || ''));
  }

  slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  normalizeImageUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/assets/upload/') || raw.startsWith('/uploads/')) return `http://localhost:3000${raw}`;
    return raw;
  }

  addImageRow(): void {
    this.showNewImageForm = true;
    const image = {
      localId: this.nextLocalId('img'),
      variant_id: null,
      image_url: '',
      preview_url: '',
      sort_order: this.images.length,
      is_primary: this.images.length === 0,
      alt_text: '',
      file: null,
    };
    this.images.push(image);
    this.selectedFormImageId = image.localId;
    this.form.markAsDirty();
  }

  selectFormImage(image: DraftImage): void {
    this.selectedFormImageId = image.localId;
  }

  onProductImageSelected(event: Event, image: DraftImage): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;

    image.file = file;
    const reader = new FileReader();
    reader.onload = () => {
      image.preview_url = typeof reader.result === 'string' ? reader.result : '';
      if (!image.image_url) image.image_url = image.preview_url;
      this.form.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  onImagePrimaryChange(image: DraftImage): void {
    if (image.is_primary) {
      this.images.forEach((item) => {
        if (item.localId !== image.localId) item.is_primary = false;
      });
    }
    this.form.markAsDirty();
  }

  removeImageRow(image: DraftImage): void {
    if (image._id) this.removedImageIds.add(image._id);
    this.images = this.images.filter((item) => item.localId !== image.localId);
    if (this.selectedFormImageId === image.localId) {
      this.selectedFormImageId = this.images[0]?.localId || null;
    }
    if (!this.images.some((item) => !item._id)) {
      this.showNewImageForm = false;
    }
    if (this.images.length && !this.images.some((item) => item.is_primary)) {
      this.images[0].is_primary = true;
    }
    this.form.markAsDirty();
  }

  get selectedFormImage(): DraftImage | null {
    return this.images.find((item) => item.localId === this.selectedFormImageId) || null;
  }

  openCreateVariant(): void {
    this.editingVariantIndex = -1;
    this.variantDraft = this.createEmptyVariant();
    this.variantError = '';
    this.showVariantModal = true;
  }

  openEditVariant(index: number): void {
    this.editingVariantIndex = index;
    this.variantDraft = { ...this.variants[index], localId: this.variants[index].localId };
    this.variantError = '';
    this.showVariantModal = true;
  }

  closeVariantModal(): void {
    this.showVariantModal = false;
    this.variantError = '';
  }

  saveVariantDraft(): void {
    const duplicateSku = this.variants.some((item, idx) =>
      idx !== this.editingVariantIndex &&
      String(item.sku || '').trim().toLowerCase() === String(this.variantDraft.sku || '').trim().toLowerCase()
    );

    if (!this.variantDraft.variant_name.trim()) {
      this.variantError = 'Tên biến thể là bắt buộc.';
      return;
    }
    if (!this.variantDraft.sku.trim()) {
      this.variantError = 'SKU biến thể là bắt buộc.';
      return;
    }
    if (duplicateSku) {
      this.variantError = 'SKU biến thể đang bị trùng.';
      return;
    }

    const draft = {
      ...this.variantDraft,
      variant_name: this.variantDraft.variant_name.trim(),
      sku: this.variantDraft.sku.trim(),
      color: this.variantDraft.color.trim(),
      price: Number(this.variantDraft.price || 0),
      compare_at_price: Number(this.variantDraft.compare_at_price || 0),
      stock_quantity: Number(this.variantDraft.stock_quantity || 0),
      sold: Number(this.variantDraft.sold || 0),
    };

    if (this.editingVariantIndex >= 0) {
      this.variants[this.editingVariantIndex] = draft;
    } else {
      this.variants = [...this.variants, draft];
    }

    this.form.markAsDirty();
    this.closeVariantModal();
  }

  removeVariant(index: number): void {
    const variant = this.variants[index];
    if (variant?._id) this.removedVariantIds.add(variant._id);
    this.variants = this.variants.filter((_, idx) => idx !== index);
    this.images = this.images.map((image) =>
      image.variant_id === variant.localId || image.variant_id === variant._id
        ? { ...image, variant_id: null }
        : image
    );
    this.form.markAsDirty();
  }

  variantDisplayName(variantId: string | null): string {
    if (!variantId) return 'Ảnh chung của sản phẩm';
    const found = this.variants.find((item) => item.localId === variantId || item._id === variantId);
    return found?.variant_name || 'Biến thể';
  }

  activeStatusLabel(status: string): string {
    return String(status || '').toLowerCase() === 'inactive' ? 'Ngừng bán' : 'Đang bán';
  }

  stockStatusLabel(status: string): string {
    return String(status || '').toLowerCase() === 'unavailable' ? 'Hết hàng' : 'Còn hàng';
  }

  back() {
    if (this.isEdit) {
      this.router.navigate(['/admin/products', this.savedProductSlug || this.routeProductKey || this.id], {
        queryParams: this.route.snapshot.queryParams,
      });
      return;
    }

    this.router.navigate(['/admin/products'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  askSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.confirmMessage = this.isEdit ? 'Lưu chỉnh sửa sản phẩm?' : 'Tạo sản phẩm mới?';
    this.confirmAction = () => this.save();
    this.showConfirm = true;
  }

  async save() {
    this.showConfirm = false;
    this.isLoading = true;

    try {
      const raw = this.form.getRawValue();
      const payload = {
        ...raw,
        category_id: raw.category_id || null,
        collection_id: raw.collection_id || null,
        description: this.normalizeDescriptionHtml(raw.description || ''),
      };

      const doc = this.isEdit
        ? await firstValueFrom(this.api.updateProduct(this.id!, payload))
        : await firstValueFrom(this.api.createProduct(payload));

      const productId = String(doc?._id || this.id || '');
      if (!productId) throw new Error('Missing product id');

      const variantIdMap = await this.syncVariants(productId);
      await this.syncImages(productId, variantIdMap);

      this.form.markAsPristine();
      this.isLoading = false;
      this.savedProductSlug = String(doc?.slug || '').trim() || this.savedProductSlug;
      this.router.navigate(['/admin/products', doc?.slug || productId], {
        queryParams: this.route.snapshot.queryParams,
      });
    } catch {
      this.isLoading = false;
      alert('Không thể lưu sản phẩm. Vui lòng kiểm tra lại dữ liệu.');
    }
  }

  private async syncVariants(productId: string): Promise<Map<string, string>> {
    const variantIdMap = new Map<string, string>();

    await this.runWithConcurrency(
      [...this.removedVariantIds],
      AdminProductForm.SAVE_CONCURRENCY,
      (removedId) => firstValueFrom(this.api.deleteVariant(removedId))
    );
    this.removedVariantIds.clear();

    await this.runWithConcurrency(this.variants, AdminProductForm.SAVE_CONCURRENCY, async (variant) => {
      const payload = {
        product_id: productId,
        name: variant.variant_name,
        variant_name: variant.variant_name,
        sku: variant.sku,
        color: variant.color,
        price: Number(variant.price || 0),
        compare_at_price: Number(variant.compare_at_price || 0),
        stock_quantity: Number(variant.stock_quantity || 0),
        status: variant.status,
        variant_status: variant.variant_status,
        sold: Number(variant.sold || 0),
      };

      const doc = variant._id
        ? await firstValueFrom(this.api.updateVariant(variant._id, payload))
        : await firstValueFrom(this.api.createVariant(payload));

      const finalId = String(doc?._id || variant._id || '');
      variant._id = finalId;
      variantIdMap.set(variant.localId, finalId);
    });

    return variantIdMap;
  }

  private async syncImages(productId: string, variantIdMap: Map<string, string>): Promise<void> {
    await this.runWithConcurrency(
      [...this.removedImageIds],
      AdminProductForm.SAVE_CONCURRENCY,
      (removedId) => firstValueFrom(this.api.deleteImage(removedId))
    );
    this.removedImageIds.clear();

    await this.runWithConcurrency(this.images, AdminProductForm.SAVE_CONCURRENCY, async (image) => {
      let imageUrl = String(image.image_url || '').trim();

      if (image.file) {
        const dataUrl = await this.readFileAsDataUrl(image.file);
        const uploaded = await firstValueFrom(this.api.uploadImage(dataUrl, this.form.controls.name.value || 'san-pham'));
        imageUrl = String(uploaded?.image_url || '').trim();
      }

      if (!imageUrl) return;

      const resolvedVariantId = image.variant_id
        ? variantIdMap.get(image.variant_id) || image.variant_id
        : null;

      const payload = {
        product_id: productId,
        variant_id: resolvedVariantId || null,
        image_url: imageUrl,
        alt_text: String(image.alt_text || ''),
        sort_order: Number(image.sort_order || 0),
        is_primary: !!image.is_primary,
      };

      const doc = image._id
        ? await firstValueFrom(this.api.updateImage(image._id, payload))
        : await firstValueFrom(this.api.createImage(payload));

      image._id = String(doc?._id || image._id || '');
      image.image_url = imageUrl;
      image.preview_url = this.normalizeImageUrl(imageUrl);
      image.file = null;
    });
  }

  private async runWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    if (!items.length) return;

    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          await worker(items[currentIndex], currentIndex);
        }
      })
    );
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Invalid file data'));
      };
      reader.onerror = () => reject(new Error('Read file failed'));
      reader.readAsDataURL(file);
    });
  }

  private normalizeDescriptionHtml(html: string): string {
    if (!html) return '';

    const container = document.createElement('div');
    container.innerHTML = html;

    container.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.maxWidth = '100%';
      element.style.boxSizing = 'border-box';
    });

    container.querySelectorAll('img').forEach((img) => {
      const rawSrc = img.getAttribute('src') || '';
      if (rawSrc.startsWith('//')) img.setAttribute('src', `https:${rawSrc}`);
      if (rawSrc.startsWith('/uploads/')) img.setAttribute('src', `http://localhost:3000${rawSrc}`);
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.width = '70%';
      img.style.maxWidth = '70%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '14px auto';
    });

    container.querySelectorAll('video, iframe').forEach((media) => {
      const element = media as HTMLElement;
      const rawSrc = element.getAttribute('src') || '';
      if (rawSrc.startsWith('//')) element.setAttribute('src', `https:${rawSrc}`);
      if (rawSrc.startsWith('/uploads/')) element.setAttribute('src', `http://localhost:3000${rawSrc}`);
      element.removeAttribute('width');
      element.removeAttribute('height');
      element.style.maxWidth = '70%';
      element.style.width = '70%';
      element.style.aspectRatio = '16 / 9';
      element.style.height = 'auto';
      element.style.display = 'block';
      element.style.margin = '14px auto';
    });

    return container.innerHTML;
  }

  closeConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }

  stayOnPage() {
    this.showLeaveConfirm = false;
    if (this.pendingLeaveResolver) {
      this.pendingLeaveResolver(false);
      this.pendingLeaveResolver = null;
    }
  }

  leavePage() {
    this.showLeaveConfirm = false;
    if (this.pendingLeaveResolver) {
      this.pendingLeaveResolver(true);
      this.pendingLeaveResolver = null;
    }
  }
}
