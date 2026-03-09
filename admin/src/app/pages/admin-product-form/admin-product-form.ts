import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-product-form.html',
  styleUrls: ['./admin-product-form.css'],
})
export class AdminProductForm implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('descriptionEditor') descriptionEditor?: ElementRef<HTMLDivElement>;
  private savedRange: Range | null = null;

  isEdit = false;
  id: string | null = null;
  isLoading = false;
  showImageMenu = false;

  selectedEditorImage: HTMLImageElement | null = null;
  selectedImagePercent = 100;
  isEditingImagePercent = false;
  draftImagePercent = '';

  categories: any[] = [];
  collections: any[] = [];

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
    this.id = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!this.id;
    this.isLoading = true;

    const reqs: any = {
      categories: this.api.getCategories({ limit: 500 }),
      collections: this.api.getCollections({ limit: 500 }),
    };

    if (this.isEdit) reqs.product = this.api.getProductById(this.id!);

    forkJoin(reqs).subscribe({
      next: (res: any) => {
        this.categories = res.categories?.items ?? res.categories ?? [];
        this.collections = res.collections?.items ?? res.collections ?? [];

        if (this.isEdit && res.product) {
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
        }

        this.syncEditorFromForm();
        this.form.markAsPristine();
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
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
    this.selectedEditorImage.style.maxWidth = '100%';
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
    const html = this.descriptionEditor?.nativeElement.innerHTML ?? '';
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

  back() {
    if (this.isEdit) this.router.navigate(['/admin/products', this.id]);
    else this.router.navigate(['/admin/products']);
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

  save() {
    this.showConfirm = false;
    this.isLoading = true;

    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      category_id: raw.category_id || null,
      collection_id: raw.collection_id || null,
    };

    const req = this.isEdit ? this.api.updateProduct(this.id!, payload) : this.api.createProduct(payload);

    req.subscribe({
      next: (doc: any) => {
        this.form.markAsPristine();
        this.isLoading = false;
        const newId = doc?._id || this.id;
        if (newId) this.router.navigate(['/admin/products', newId]);
        else this.router.navigate(['/admin/products']);
      },
      error: () => (this.isLoading = false),
    });
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
