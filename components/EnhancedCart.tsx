'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useSession } from 'next-auth/react';
import CurrencySelector from './CurrencySelector';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import {
  ShoppingCart, Trash2, Plus, Minus, FileText, FileSpreadsheet,
  Package, ArrowLeft, AlertCircle, CheckCircle2, X, Mail, Phone, Briefcase, MapPin, Zap, Search, Settings, Lock, Unlock,
  Sun, Moon
} from 'lucide-react';
import Link from 'next/link';
import { renderFormFields as renderLedDisplayFormFields } from '@/app/admin/led-displays/form-content';
import { useToast } from '@/context/ToastContext';

interface Product {
  _id: string;
  sku?: string;
  productName?: string;
  category?: string;
  description?: string;
  application?: string;

  watt?: string;
  lumen?: string;
  beamAngle?: string;
  dimension?: string;
  cutOut?: string;
  ipRating?: string;
  price?: number;
  images?: string[];
  productImages?: string[];
  // LED display specific fields (optional, passed through from products page)
  pixelPitch?: string;
  totalResolution?: string;
  sqft?: number;
  moduleSpecs?: any;
  cabinetSpecs?: any;
  screenParams?: any;
  cabinetRequired?: number;
  requiredLength?: string;
  requiredWidth?: string;
}

interface Driver {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  series?: string;
  price: number;
  wattageRange?: { min: number; max: number };
  outputVoltage?: string;
  outputCurrent?: string;

  ipRating?: string;
  type?: string;
  category?: string;
  images?: string[];
  productImages?: string[];
}

type CartItem = Product & {
  quantity: number;
  name?: string;
  cartItemId: string;
  wattage?: string | number;
  isDriver?: boolean;
  parentProductId?: string;
  // Driver-specific fields
  wattageRange?: { min: number; max: number };
  outputVoltage?: string;
  outputCurrent?: string;
  type?: string;
  series?: string;
  customTotalConverted?: number;
  // Display-specific editable fields
  suggestedSize?: string;
  cabinetArrangementWidth?: number;
  cabinetArrangementHeight?: number;
  // Spare and accessory fields
  spareModules?: string | number;
  sparePSU?: string | number;
  spareReceivingCard?: string | number;
  package?: string;
  novastarController?: string;
  // CMS with license duration
  cmsInclude?: string;
  cmsLicenseYears?: number;
  // MS Structure
  msStructureSqm?: number;
  // Controllers on cart
  controller1Name?: string;
  controller1Price?: number;
  controller1Qty?: number;
  controller2Name?: string;
  controller2Price?: number;
  controller2Qty?: number;
};

const isDisplayItem = (item: CartItem) => {
  const category = item.category?.toLowerCase() || '';
  return category.includes('display') || !!item.pixelPitch || typeof item.sqft === 'number';
};

export default function EnhancedCart() {
  const [mounted, setMounted] = useState(false);
  const { cart, removeFromCart, clearCart, increaseQuantity, decreaseQuantity, updateQuantity, addDriverToCart, updateCartItem } = useCart() as {
    cart: CartItem[];
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    increaseQuantity: (id: string) => void;
    decreaseQuantity: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    addDriverToCart: (driver: Driver, parentProductId: string, quantity?: number) => void;
    updateCartItem: (cartItemId: string, updates: Partial<CartItem>) => void;
  };
  const { formatPrice, convertPrice, currencyInfo } = useCurrency();
  const { data: session } = useSession();
  const { showToast } = useToast();

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin';

  const [userInfo, setUserInfo] = useState({ email: '', mobile: '', project: '', company: '', subject: '', invoiceNo: '' });
  const [autoInvoiceNo, setAutoInvoiceNo] = useState('');
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [productCodes, setProductCodes] = useState<Record<string, string>>({});
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<'bahrain' | 'uae' | 'bangalore' | 'delhi'>('bahrain');
  const [discount, setDiscount] = useState(0); // Discount percentage (0-15%)
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedProductForDriver, setSelectedProductForDriver] = useState<CartItem | null>(null);
  const [customDriverName, setCustomDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverWattage, setEditDriverWattage] = useState('');
  const [editDriverPrice, setEditDriverPrice] = useState('');
  const [editDriverQuantity, setEditDriverQuantity] = useState(1);
  const [customDriverWattage, setCustomDriverWattage] = useState('');
  const [customDriverPrice, setCustomDriverPrice] = useState('');
  const [customDriverQuantity, setCustomDriverQuantity] = useState(1);
  const [isExcelLoading, setIsExcelLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingType, setDownloadingType] = useState<'excel' | 'pdf' | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<'excel' | 'pdf' | null>(null);

  const [editingDisplay, setEditingDisplay] = useState<CartItem | null>(null);
  const [displayFormData, setDisplayFormData] = useState<any | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<any>(null);
  const [editSpecs, setEditSpecs] = useState<any>({});
  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState<'pdf' | 'excel' | null>(null);
  const [showMissingDetailsPopup, setShowMissingDetailsPopup] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Password lock for Price Calculation editing
  const [priceEditUnlocked, setPriceEditUnlocked] = useState(false);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [priceEditPassword, setPriceEditPassword] = useState('');
  const [priceEditError, setPriceEditError] = useState('');
  const PRICE_EDIT_PASSWORD = 'Qlitescreen2025';



  // Initialize theme from localStorage so it matches the products page selection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTheme = window.localStorage.getItem('qlite-theme');
      if (storedTheme === 'light') {
        setIsDarkMode(false);
      } else if (storedTheme === 'dark') {
        setIsDarkMode(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Terms and Conditions state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState({
    // Common LED lights terms (structured fields)
    deliveryLocation: 'DDP Bahrain',
    deliveryTime: '8-10 Weeks',
    paymentTerms: '50% advance and balance 50% on delivery',
    productMake: 'Qlite UK make',
    validityDays: '45 days',
    vatNote: 'VAT will charged as per applicable government regulations',
    salesPersonName: '',
    // Which terms to use in the PDF: 'lights' | 'displays' | 'lightingControls'
    termsType: 'lights' as 'lights' | 'displays' | 'lightingControls',
    // Free-form terms text for LED Displays (multi-line, editable)
    displayTerms:
      '1. Lead time: within 10 Days\n' +
      '2. Payment term: 50% with PO and 50% before delivery\n' +
      '3. Warranty: 3 years\n' +
      '4. This quotation is valid for 10 days\n' +
      '5. Replacement of modules is included during warranty period\n' +
      '6. Any type of civil work is in client scope\n' +
      '7. Pricing of controller will be changed as per the client requirement\n' +
      '8. GST Rates: As Applicable\n' +
      '9. Cranes or ladders required are in client scope\n' +
      '10. MS Structure Fabrication and installation at site is in Qlite scope\n' +
      '11. Structure drawing, Control drawing will be provided by Qlite\n' +
      '12. Supply, Installation, Testing and Commissioning of Videowall - Qlite scope\n' +
      '13. Payment Processing: A/c transfer\n' +
      '14. Unloading and storing of LED screen at site location is in client scope',
    // Free-form terms text for Lighting Controls (multi-line, editable)
    lightingControlsTerms:
      'Supply of Lighting Control system\n' +
      'Schematics and drawings for termination details will be provided by us.\n' +
      'Operation and Maintenance Manuals will be provided by us\n' +
      'Supply, pulling & termination of any type of cabling or cabling related to 230V or higher are excluded from our scope.\n' +
      'Supply, pulling & termination of control cable excluded from our scope.\n' +
      'Any type of civil work is excluded from the scope.',
  });

  // Helper to compute the screen-only total for a single cart item (excluding controllers) in selected currency
  // For displays, this matches the same Area(sqm) logic as the Edit LED price panel and PDF:
  // total = Area(sqm) × price per sqm (USD) × quantity.
  const computeItemTotal = (item: CartItem): number => {
    const asAny = item as any;

    // If there's a manual override, use that (already in converted currency)
    if (typeof asAny.customTotalConverted === 'number') {
      return asAny.customTotalConverted;
    }

    const qty = item.quantity ?? 1;

    // For LED display items, use suggested-size / cabinet-arrangement area
    if (isDisplayItem(item)) {
      const widM = parseFloat(asAny.requiredLength ?? '0');
      const heiM = parseFloat(asAny.requiredWidth ?? '0');
      const hasWid = !isNaN(widM) && widM > 0;
      const hasHei = !isNaN(heiM) && heiM > 0;

      let areaSqm = 0;
      if (hasWid && hasHei && asAny.cabinetSpecs?.cabinetSize) {
        const sizeStr: string = String(asAny.cabinetSpecs.cabinetSize);
        const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
        if (match) {
          const cabWidMm = parseFloat(match[1]);
          const cabHeiMm = parseFloat(match[2]);
          if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
            const cabWidM = cabWidMm / 1000;
            const cabHeiM = cabHeiMm / 1000;
            const cabsWid = widM / cabWidM;
            const cabsHei = heiM / cabHeiM;

            const customRound = (v: number) => {
              const dec = v - Math.floor(v);
              return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
            };

            const roundedW = customRound(cabsWid);
            const roundedH = customRound(cabsHei);

            const sugWid = roundedW * cabWidM;
            const sugHei = roundedH * cabHeiM;
            areaSqm = sugWid * sugHei;
          }
        }
      }

      // Fallback: width×height if we can't derive area from cabinet size
      if (areaSqm <= 0 && hasWid && hasHei) {
        areaSqm = widM * heiM;
      }

      if (areaSqm > 0) {
        const totalUSD = areaSqm * (item.price ?? 0) * qty;
        return convertPrice(totalUSD);
      }
    }

    // Non-display items or missing dimensions: fallback to simple price × qty
    const totalUSD = (item.price ?? 0) * qty;
    return convertPrice(totalUSD);
  };

  // Helper to compute controller totals for summary
  const computeControllerTotal = (item: CartItem): number => {
    const asAny = item as any;
    let controllerTotal = 0;

    // Add Controller 1 price (price * quantity) - convert to selected currency
    if (typeof asAny.controller1Price === 'number' && asAny.controller1Price > 0 &&
      typeof asAny.controller1Qty === 'number' && asAny.controller1Qty > 0) {
      controllerTotal += convertPrice(asAny.controller1Price) * asAny.controller1Qty;
    }

    // Add Controller 2 price (price * quantity) - convert to selected currency
    if (typeof asAny.controller2Price === 'number' && asAny.controller2Price > 0 &&
      typeof asAny.controller2Qty === 'number' && asAny.controller2Qty > 0) {
      controllerTotal += convertPrice(asAny.controller2Price) * asAny.controller2Qty;
    }

    return controllerTotal;
  };

  // Helper to compute CMS totals for summary (per display, in selected currency)
  const computeCmsTotal = (item: CartItem): number => {
    const asAny = item as any;

    if (!asAny.cmsInclude || String(asAny.cmsInclude).toLowerCase() !== 'yes') {
      return 0;
    }

    const years = asAny.cmsLicenseYears || 3;
    const priceMap: { [key: number]: number } = { 1: 125, 3: 375, 5: 625, 7: 875 };
    const cmsPriceUSD = priceMap[years] || 375;

    // Convert CMS license price from USD to selected currency
    return convertPrice(cmsPriceUSD);
  };

  // Calculate subtotal: screen prices + controller prices + CMS prices
  const screenSubtotal = cart.reduce((sum, item) => sum + computeItemTotal(item), 0);
  const controllerSubtotal = cart.reduce((sum, item) => sum + computeControllerTotal(item), 0);
  const cmsSubtotal = cart.reduce((sum, item) => sum + computeCmsTotal(item), 0);
  const subtotal = screenSubtotal + controllerSubtotal + cmsSubtotal;
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  // --- Auto Quotation Number Generation ---
  const getProductCodeForCart = () => {
    const hasDisplays = cart.some(item => !item.isDriver && isDisplayItem(item));
    const hasLightingControls = cart.some(item => (item as any).isLightingControl);

    if (hasDisplays) return 'PLD'; // LED Displays
    if (hasLightingControls) return 'LCS'; // Lighting Controls
    return 'LF'; // Default: LED Lights
  };

  const getCountryCodeForAddress = () => {
    switch (selectedAddress) {
      case 'bahrain':
        return 'BH';
      case 'uae':
        return 'UAE';
      case 'bangalore':
      case 'delhi':
        return 'IN';
      default:
        return 'BH';
    }
  };

  const formatDateForQuote = (date: Date) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return { yy, mm, dd };
  };

  // Read current serial without incrementing (for on-screen preview)
  const getCurrentSerial = () => {
    if (typeof window === 'undefined') return '001';

    try {
      const storageKey = 'qlite-quote-serial-global';
      const currentRaw = window.localStorage.getItem(storageKey);
      const current = currentRaw ? parseInt(currentRaw, 10) : 1;
      const safe = isNaN(current) || current <= 0 ? 1 : current;
      return String(safe).padStart(3, '0');
    } catch {
      return '001';
    }
  };

  // Allocate the next serial and persist it (for exports only)
  const allocateNextSerial = () => {
    if (typeof window === 'undefined') return '001';

    try {
      const storageKey = 'qlite-quote-serial-global';
      const currentRaw = window.localStorage.getItem(storageKey);
      const current = currentRaw ? parseInt(currentRaw, 10) : 0;
      const next = isNaN(current) ? 1 : current + 1;
      window.localStorage.setItem(storageKey, String(next));
      return String(next).padStart(3, '0');
    } catch {
      // Fallback if localStorage fails
      return '001';
    }
  };

  const generateQuotationNumber = (serial: string) => {
    const companyCode = 'QL';
    const productCode = getProductCodeForCart();
    const countryCode = getCountryCodeForAddress();
    const today = new Date();
    const { yy, mm, dd } = formatDateForQuote(today);
    return `${companyCode}/${productCode}/${countryCode}/${yy}/${mm}/${dd}/${serial}`;
  };

  // Auto-fill quotation removed for manual Project Code entry
  const canDownload =
    !!userInfo.email &&
    !!userInfo.mobile &&
    !!userInfo.project &&
    !!userInfo.company &&
    !!userInfo.invoiceNo;
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setShowError(false);
  };

  // Update delivery location when address changes
  useEffect(() => {
    updateDeliveryLocation(selectedAddress);
  }, [selectedAddress]);

  const handleCloseDisplayEdit = () => {
    setEditingDisplay(null);
    setDisplayFormData(null);
    setPriceEditUnlocked(false);
    setShowPriceEditModal(false);
    setPriceEditPassword('');
    setPriceEditError('');
  };

  const handleSaveDisplayEdit = () => {
    if (!editingDisplay || !displayFormData) return;

    const formatSpare = (nameKey: string, qtyKey: string) => {
      const name = (displayFormData as any)[nameKey] as string | undefined;
      const qty = (displayFormData as any)[qtyKey] as number | undefined;
      if (!qty || qty <= 0) return undefined;
      const trimmedName = (name || '').trim();
      return trimmedName ? `${trimmedName} - ${qty}` : String(qty);
    };

    // Auto-sync MS Structure Area from Price Calculation (use same suggested-size logic)
    const widM = parseFloat(displayFormData?.requiredLength ?? '0');
    const heiM = parseFloat(displayFormData?.requiredWidth ?? '0');
    const hasWid = !isNaN(widM) && widM > 0;
    const hasHei = !isNaN(heiM) && heiM > 0;

    let areaSqm = 0;
    if (hasWid && hasHei && (displayFormData as any)?.cabinetSpecs?.cabinetSize) {
      const sizeStr: string = String((displayFormData as any).cabinetSpecs.cabinetSize);
      const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const cabWidMm = parseFloat(match[1]);
        const cabHeiMm = parseFloat(match[2]);
        if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
          const cabWidM = cabWidMm / 1000;
          const cabHeiM = cabHeiMm / 1000;
          const cabsWid = widM / cabWidM;
          const cabsHei = heiM / cabHeiM;

          const customRound = (v: number) => {
            const dec = v - Math.floor(v);
            return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
          };

          const roundedW = customRound(cabsWid);
          const roundedH = customRound(cabsHei);

          const sugWid = roundedW * cabWidM;
          const sugHei = roundedH * cabHeiM;
          areaSqm = sugWid * sugHei;
        }
      }
    }

    // Fallback: if we could not derive area from cabinet size, use width×height.
    if (areaSqm <= 0 && hasWid && hasHei) {
      areaSqm = widM * heiM;
    }

    const updates: Partial<CartItem> = {
      category: displayFormData.category,
      application: displayFormData.application,
      ipRating: displayFormData.ipRating,
      pixelPitch: displayFormData.pixelPitch,
      totalResolution: displayFormData.totalResolution,
      sqft: displayFormData.sqft,
      price: displayFormData.price,
      images: displayFormData.images,
      productImages: displayFormData.productImages,
      moduleSpecs: displayFormData.moduleSpecs,
      cabinetSpecs: displayFormData.cabinetSpecs,
      screenParams: displayFormData.screenParams,
      // Include editable calculation fields
      requiredLength: displayFormData.requiredLength,
      requiredWidth: displayFormData.requiredWidth,
      suggestedSize: (displayFormData as any).suggestedSize,
      cabinetRequired: displayFormData.cabinetRequired,
      customTotalConverted: displayFormData.customTotalConverted,
      // Spare and accessory fields (store combined name + quantity)
      spareModules: formatSpare('spareModulesName', 'spareModulesQty') ?? displayFormData.spareModules,
      sparePSU: formatSpare('sparePSUName', 'sparePSUQty') ?? displayFormData.sparePSU,
      spareReceivingCard: formatSpare('spareReceivingCardName', 'spareReceivingCardQty') ?? displayFormData.spareReceivingCard,
      package: formatSpare('packageName', 'packageQty') ?? displayFormData.package,
      // CMS with license duration
      cmsInclude: (displayFormData as any).cmsInclude,
      cmsLicenseYears: (displayFormData as any).cmsLicenseYears,
      // MS Structure - auto-synced from suggested-size area (matches Price Calculation / PDF)
      msStructureSqm: areaSqm > 0 ? areaSqm : undefined,
    };

    updateCartItem(editingDisplay.cartItemId, updates);
    showToast('Display settings updated successfully', 'success');
    handleCloseDisplayEdit();
  };

  // Open simple driver modal
  const fetchDriversForProduct = (product: CartItem) => {
    setSelectedProductForDriver(product);
    setCustomDriverName('');
    setCustomDriverWattage('');
    setCustomDriverPrice('');
    setCustomDriverQuantity(1);
    setShowDriverModal(true);
  };

  const handleAddCustomDriver = () => {
    if (selectedProductForDriver && customDriverName) {
      const driverObj: any = {
        _id: `custom-driver-${Date.now()}`,
        name: customDriverName,
        sku: 'CUSTOM-DRIVER',
        price: Number(customDriverPrice) || 0,
        wattage: customDriverWattage || 'N/A',
        isDriver: true
      };

      addDriverToCart(driverObj, selectedProductForDriver.cartItemId, customDriverQuantity);
      setShowDriverModal(false);
    }
  };

  const handleCloseDriverModal = () => {
    setShowDriverModal(false);
  };

  // Get drivers associated with a product
  const getDriversForProduct = (productCartItemId: string) => {
    return cart.filter(item => item.isDriver && item.parentProductId === productCartItemId);
  };

  // Separate products and standalone drivers
  const products = cart.filter(item => !item.isDriver);
  const standaloneDrivers = cart.filter(item => item.isDriver && !item.parentProductId);

  // Generate project description from product attributes
  const generateProjectDescription = (item: CartItem): string => {
    const parts = [];

    if (item.watt) parts.push(`${item.watt}${String(item.watt).toUpperCase().includes('W') ? '' : 'W'}`);
    if (item.category) parts.push(item.category);

    const details = [];
    if (item.application) details.push(item.application);
    if (item.lumen) details.push(`${item.lumen}lm`);

    if (item.beamAngle) details.push(`${item.beamAngle} beam angle`);
    if (item.ipRating && item.ipRating.trim() !== '') details.push(item.ipRating);

    let description = parts.join(' ');
    if (details.length > 0) {
      description += ` (${details.join(', ')})`;
    }

    return description || 'LED Light';
  };

  const exportExcel = async () => {
    if (isExcelLoading || downloadingType !== null) return;
    setIsExcelLoading(true);

    setDownloadProgress(0);
    setDownloadingType('excel');
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + 10;
      });
    }, 200);

    try {
      // Check if user is logged in
      if (!session) {
        clearInterval(progressInterval);
        setDownloadingType(null);
        setShowLoginPrompt(true);
        return;
      }

      if (!canDownload) { setShowError(true); return; }

      if (!userInfo.invoiceNo || userInfo.invoiceNo.trim() === '') {
        showToast('Please enter a Project Code before downloading', 'error');
        clearInterval(progressInterval);
        setDownloadingType(null);
        return;
      }

      // Persist quotation + user snapshot in backend
      try {
        const res = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quotationNumber: userInfo.invoiceNo,
            clientName: userInfo.project || userInfo.company || 'Client',
            clientEmail: userInfo.email || session?.user?.email || '',
            products: cart.map(item => ({
              productId: !String((item as any)._id || '').startsWith('custom-')
                ? ((item as any)._id || undefined)
                : undefined,
              sku: item.isDriver 
                ? ((item as any).name || 'Driver')
                : item.sku || '',
              category: item.category || '',
              quantity: item.quantity ?? 1,
              unitPrice: item.price ?? 0,
              totalPrice: (item.price ?? 0) * (item.quantity ?? 1),
              watt: item.watt,
              lumen: (item as any).lumen || '',
              beamAngle: (item as any).beamAngle || '',
              ipRating: Array.isArray(item.ipRating)
                ? item.ipRating.join(', ')
                : item.ipRating || '',
              cct: (item as any).cct || '',
              dimming: (item as any).dimming || '',
              accessories: (item as any).accessories || '',
              finish: (item as any).finish || '',
              reflectorFinish: (item as any).reflectorFinish || '',
              dimension: (item as any).dimension || '',
              isDriver: item.isDriver || false,
              driverName: item.isDriver 
                ? `${(item as any).name || 'Driver'}${(item as any).wattage ? ' - ' + (item as any).wattage + 'W' : ''}`
                : '',
              driverWattage: item.isDriver ? (item as any).wattage || '' : '',
              itemCode: '',
            })),
            totalPrice: total,
            userDepartment: session?.user?.department || '',
            userCountry: session?.user?.country || '',
            userMobile: session?.user?.mobile || userInfo.mobile || '',
            userCompanyName: session?.user?.companyName || userInfo.company || '',
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API error ${res.status}: ${errText}`);
        }
      } catch (err) {
        console.error('Failed to save quotation record:', err);
        // Continue with export even if saving fails
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cart');

      // Get dynamic address based on currency
      const addressInfo = getAddressInfo();

      // SECTION 1 - HEADER
      worksheet.getRow(1).height = 65;

      // Add logo on the left side
      try {
        const logoResponse = await fetch('/logo.jpg');
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoId = workbook.addImage({
            buffer: logoBuffer,
            extension: 'jpeg',
          });
          worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 } as any,
            br: { col: 1.5, row: 1 } as any,
            editAs: 'oneCell'
          } as any);
        }
      } catch (error) {
        console.error('Error adding logo:', error);
      }

      // Add headerImage on the right side
      try {
        const headerImageResponse = await fetch('/HEADERIMAGE.jpeg');
        if (headerImageResponse.ok) {
          const headerImageBuffer = await headerImageResponse.arrayBuffer();
          const headerImageId = workbook.addImage({
            buffer: headerImageBuffer,
            extension: 'jpeg',
          });
          worksheet.addImage(headerImageId, {
            tl: { col: 1.5, row: 0 } as any,
            br: { col: 9, row: 1 } as any,
            editAs: 'oneCell'
          } as any);
        }
      } catch (error) {
        console.error('Error adding headerImage:', error);
      }
      // SECTION 2 - ADDRESS
      worksheet.getRow(2).height = 90;
      worksheet.mergeCells(2, 1, 2, 9);
      const addressCell = worksheet.getCell(2, 1);
      addressCell.value = addressInfo.lines.join('\n');
      addressCell.font = { bold: true, size: 9 };
      addressCell.alignment = {
        wrapText: true,
        vertical: 'middle',
        horizontal: 'left'
      };
      addressCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFA5B7CD' }
      };

      const excelCurrency = 'INR';

      // SECTION 3 - TABLE
      const startRow = 3;
      const headerRow = worksheet.getRow(startRow);
      const columns = [
        'S.No.', 'Code', 'Description', 'Model No.', 'Image', 'Unit', 'Quantity', 'Unit Price', 'Total Amount'
      ];

      columns.forEach((col, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = col;
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB7B7B7' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      headerRow.height = 20;

      worksheet.getColumn(1).width = 8;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 35;
      worksheet.getColumn(4).width = 20;
      worksheet.getColumn(5).width = 15;
      worksheet.getColumn(6).width = 10;
      worksheet.getColumn(7).width = 10;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 15;

      // Helper function to get image URL
      const getPrimaryImageUrl = (item: CartItem): string | null => {
        return item.productImages?.[0] || item.images?.[0] || null;
      };

      // Helper function to resolve Google Drive URLs
      const resolveImageUrl = async (url: string): Promise<string> => {
        try {
          if (url.includes('drive.google.com')) {
            const res = await fetch('/api/resolve-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.url) return data.url as string;
            }
          }
        } catch { }
        return url;
      };

      // Helper function to fetch image as buffer
      const fetchImageBuffer = async (url: string): Promise<ArrayBuffer | null> => {
        try {
          const resolvedUrl = await resolveImageUrl(url);
          const response = await fetch(resolvedUrl, { mode: 'cors' });
          if (!response.ok) return null;
          return await response.arrayBuffer();
        } catch {
          return null;
        }
      };

      // Reorganize cart to group drivers with their parent products
      const organizedCartExcel: CartItem[] = [];
      cart.forEach(item => {
        if (!item.isDriver) {
          organizedCartExcel.push(item);
          const productDrivers = cart.filter(d => d.isDriver && d.parentProductId === item.cartItemId);
          organizedCartExcel.push(...productDrivers);
        }
      });
      const standaloneDriversExcel = cart.filter(item => item.isDriver && !item.parentProductId);
      organizedCartExcel.push(...standaloneDriversExcel);

      const hasOnlyLightingControlsExcel = organizedCartExcel.every(item =>
        item.isDriver || (item as any).isLightingControl
      );

      let serialNumber = 1;
      let currentRowIndex = startRow + 1;

      for (let i = 0; i < organizedCartExcel.length; i++) {
        const item = organizedCartExcel[i];

        if (item.isDriver) {
          // DRIVER row
          const rowIndex = currentRowIndex;
          const row = worksheet.getRow(rowIndex);
          row.height = 20;

          const parts: string[] = [];
          if (item.wattageRange) parts.push(`Power: ${item.wattageRange.min}W`);
          if (item.outputVoltage) parts.push(`Output: ${item.outputVoltage}`);
          if ((item as any).outputCurrent) parts.push(`Current: ${(item as any).outputCurrent}`);

          if ((item as any).ipRating) parts.push(`IP: ${(item as any).ipRating}`);
          if ((item as any).type) parts.push(`Type: ${(item as any).type}`);
          const specText = parts.join(' | ');

          const driverLabel = item.name
            ? `${item.name}${item.wattage && item.wattage !== 'N/A' ? ' - ' + item.wattage + (String(item.wattage).toUpperCase().includes('W') ? '' : 'W') : ''}`
            : item.sku ?? 'Driver';

          if (hasOnlyLightingControlsExcel) {
            row.getCell(1).value = serialNumber;
            row.getCell(2).value = '';
            row.getCell(3).value = driverLabel;
            row.getCell(4).value = specText;
            row.getCell(5).value = item.quantity ?? 1;
            row.getCell(6).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            row.getCell(7).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            for (let col = 1; col <= 7; col++) {
              const cell = row.getCell(col);
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { bold: false, size: 9 };
            }
          } else {
            row.getCell(1).value = serialNumber;
            row.getCell(2).value = '';
            row.getCell(3).value = driverLabel;
            row.getCell(4).value = specText;
            row.getCell(5).value = '';
            row.getCell(6).value = 'Nos';
            row.getCell(7).value = item.quantity ?? 1;
            row.getCell(8).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            row.getCell(9).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            for (let col = 1; col <= 9; col++) {
              const cell = row.getCell(col);
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              if (col === 3 || col === 4) {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
              } else {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              }
              cell.font = { bold: false, size: 9 };
            }
          }

          currentRowIndex++;
          serialNumber++;
        } else if ((item as any).isLightingControl && hasOnlyLightingControlsExcel) {
          // LIGHTING CONTROL
          const rowIndex = currentRowIndex;
          const row1Index = currentRowIndex;
          const row2Index = row1Index + 1;
          const row1 = worksheet.getRow(row1Index);
          const row2 = worksheet.getRow(row2Index);
          row1.height = 50;
          row2.height = 50;

          const asAny = item as any;

          row1.getCell(1).value = serialNumber;
          worksheet.mergeCells(row1Index, 1, row2Index, 1);

          row1.getCell(2).value = '';
          worksheet.mergeCells(row1Index, 2, row2Index, 2);

          row1.getCell(3).value = asAny.productName || item.sku || 'N/A';
          worksheet.mergeCells(row1Index, 3, row2Index, 3);

          row1.getCell(4).value = asAny.description || '-';
          worksheet.mergeCells(row1Index, 4, row2Index, 4);

          row1.getCell(5).value = item.quantity ?? 1;
          worksheet.mergeCells(row1Index, 5, row2Index, 5);

          row1.getCell(6).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          worksheet.mergeCells(row1Index, 6, row2Index, 6);

          row1.getCell(7).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          worksheet.mergeCells(row1Index, 7, row2Index, 7);

          for (let r = row1Index; r <= row2Index; r++) {
            for (let col = 1; col <= 7; col++) {
              const cell = worksheet.getRow(r).getCell(col);
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
              cell.font = { bold: false, size: 9, color: { argb: 'FF000000' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            }
          }

          const imageUrl = getPrimaryImageUrl(item);
          if (imageUrl) {
            const imageBuffer = await fetchImageBuffer(imageUrl);
            if (imageBuffer) {
              try {
                const imageId = workbook.addImage({ buffer: imageBuffer, extension: 'jpeg' });
                worksheet.addImage(imageId, {
                  tl: { col: 1.15, row: row1Index - 1 + 0.25 },
                  ext: { width: 70, height: 70 },
                  editAs: 'oneCell'
                });
              } catch (error) {
                console.error('Error adding image:', error);
              }
            }
          }

          currentRowIndex += 2;
          serialNumber++;
        } else {
          // LED PRODUCT
          const row1Index = currentRowIndex;
          const row1 = worksheet.getRow(row1Index);

          const specCount = [
            item.category, (item as any).type, item.watt,
            (item as any).dimension, (item as any).beamAngle,
            (item as any).lumen, item.ipRating,
            (item as any).cct,
            (item as any).dimming, (item as any).accessories,
            (item as any).finish, (item as any).reflectorFinish
          ].filter(v => v && v !== '-' && v !== '').length;

          const rowHeight = Math.max(60, specCount * 15);
          row1.height = rowHeight;

          // 1. S.No.
          row1.getCell(1).value = serialNumber;

          // 2. Code
          const itemCode = productCodes[item.cartItemId] || '';
          row1.getCell(2).value = itemCode;

          // 3. Description
          const specLines: any[] = [];
          const addSpec = (label: string, value: any, isLast = false) => {
            const val = Array.isArray(value) ? value.join(', ') : value;
            if (val && val !== '-' && val !== '') {
              specLines.push({ text: label, font: { bold: true, size: 9 } });
              specLines.push({ text: `${val}${isLast ? '' : '\n'}`, font: { bold: false, size: 9 } });
            }
          };

          addSpec('Category: ', item.category);
          addSpec('Wattage: ', item.watt ? item.watt + (String(item.watt).toUpperCase().includes('W') ? '' : 'W') : null);
          addSpec('Dimension: ', (item as any).dimension);
          addSpec('Beam Angle: ', (item as any).beamAngle);
          addSpec('Lumen: ', (item as any).lumen);
          addSpec('IP Rating: ', Array.isArray(item.ipRating) ? item.ipRating.join(', ') : item.ipRating);
          addSpec('CCT: ', (item as any).cct);
          addSpec('Dimming: ', (item as any).dimming);
          addSpec('Accessories: ', (item as any).accessories);
          addSpec('Finish: ', (item as any).finish);
          addSpec('Reflector Finish: ', (item as any).reflectorFinish, true);

          row1.getCell(3).value = { richText: specLines };
          row1.getCell(3).alignment = {
            wrapText: true, vertical: 'top', horizontal: 'left'
          };

          // 4. Model No.
          row1.getCell(4).value = item.sku ?? 'N/A';

          // 5. Image
          row1.getCell(5).value = '';

          // 6. Unit
          row1.getCell(6).value = 'Nos';

          // 7. Quantity
          row1.getCell(7).value = item.quantity ?? 1;

          // 8. Unit Price
          row1.getCell(8).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          // 9. Total Amount
          row1.getCell(9).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          // Borders and Formatting
          for (let col = 1; col <= 9; col++) {
            const cell = worksheet.getRow(row1Index).getCell(col);
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            if (col === 3) {
              cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }

            if (col !== 3) {
              cell.font = { bold: false, size: 9, color: { argb: 'FF000000' } };
            }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          }

          // Add image
          const imageUrl = getPrimaryImageUrl(item);
          if (imageUrl) {
            const imageBuffer = await fetchImageBuffer(imageUrl);
            if (imageBuffer) {
              try {
                const imageId = workbook.addImage({ buffer: imageBuffer, extension: 'jpeg' });
                worksheet.addImage(imageId, {
                  tl: { col: 4.85, row: row1Index - 1 + 0.10 },
                  ext: { width: 65, height: 65 },
                  editAs: 'oneCell'
                });
              } catch (error) {
                console.error('Error adding image:', error);
              }
            }
          }

          currentRowIndex += 1;
          serialNumber++;
        }
      }

      // SECTION 4 - TOTAL ROW
      const totalRowIndex = currentRowIndex;
      const totalRow = worksheet.getRow(totalRowIndex);

      // Merge cols 7-8 for label, put value in 9
      worksheet.mergeCells(totalRowIndex, 7, totalRowIndex, 8);
      totalRow.getCell(7).value = `Total Amount (${excelCurrency}):`;
      totalRow.getCell(7).font = { bold: true, size: 14 };
      totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      totalRow.getCell(7).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      totalRow.getCell(9).value = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      totalRow.getCell(9).font = { bold: true, size: 14 };
      totalRow.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };
      totalRow.getCell(9).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      // SECTION 5 - TERMS AND CONDITIONS
      const termsStartRow = totalRowIndex + 1; // 2 blank rows
      worksheet.getRow(termsStartRow).getCell(1).value = 'Terms and Conditions:';
      worksheet.getRow(termsStartRow).getCell(1).font = { bold: true, size: 11, underline: true };
      worksheet.mergeCells(termsStartRow, 1, termsStartRow, 9);

      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getRow(termsStartRow).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      const terms = [
        `1. The prices quoted on ${termsAndConditions.deliveryLocation}.`,
        `2. Delivery: Within ${termsAndConditions.deliveryTime} from the date of PO and advance payment.`,
        `3. Payment Terms: ${termsAndConditions.paymentTerms}.`,
        `4. The quoted products are ${termsAndConditions.productMake}`,
        `5. Validity of offer: ${termsAndConditions.validityDays}`,
        `6. ${termsAndConditions.vatNote}`
      ];

      terms.forEach((term, index) => {
        const rowNum = termsStartRow + index + 1;
        const row = worksheet.getRow(rowNum);
        row.getCell(1).value = term;
        row.getCell(1).font = { bold: true, size: 9 };
        row.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
        worksheet.mergeCells(rowNum, 1, rowNum, 9);
        row.height = 25;

        for (let col = 1; col <= 9; col++) {
          const cell = worksheet.getRow(rowNum).getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });

      // Set print options
      worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3
        }
      };

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${userInfo.project}_cart.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      clearInterval(progressInterval);
      setDownloadProgress(100);
      setDownloadSuccess('excel');
      setTimeout(() => {
        setDownloadSuccess(null);
        setDownloadProgress(0);
        setDownloadingType(null);
      }, 3000);
    } finally {
      setIsExcelLoading(false);
    }
  };

  // Get address based on user selection
  // Update delivery location based on selected address
  const updateDeliveryLocation = (address: 'bahrain' | 'uae' | 'bangalore' | 'delhi') => {
    const locationMap = {
      'bahrain': 'DDP Bahrain',
      'uae': 'DDP Dubai, UAE',
      'bangalore': 'DDP Bangalore, India',
      'delhi': 'DDP Delhi, India'
    };
    setTermsAndConditions(prev => ({
      ...prev,
      deliveryLocation: locationMap[address]
    }));
  };

  const getAddressInfo = () => {
    switch (selectedAddress) {
      case 'uae':
        return {
          lines: [
            'Qlite Integrated Solutions',
            'Lighting Store',
            'Office No. 905, Sobha Ivory 1 Tower,',
            'Business Bay, Dubai – UAE',
            'E-mail: sales@qliteglobal.com',
            'TEL: +973 3330 8969'
          ]
        };
      case 'bangalore':
        return {
          lines: [
            'Qlite Electronics Controls Private Limited',
            'First Floor, Block -2, KSSIDC Complex, A-203,',
            'Indra Nagar, Electronic City Phase I,',
            'Electronic City, Bengaluru, Karnataka 560100',
            'E-mail: sales@qliteglobal.com',
            'TEL: +973 3330 8969'
          ]
        };
      case 'delhi':
        // LED Lights condition (defaults when it's neither displays nor lighting controls)
        if (termsAndConditions?.termsType !== 'displays' && termsAndConditions?.termsType !== 'lightingControls') {
          return {
            lines: [
              "Qlite Ltd, Wyastone Business Park, Monmouth NP25 3SR, United Kingdom",
              "Manufacturing: Unit 4, Severnside, Newhouse Farm Industrial Estate, Chepstow NP16 6UN, United Kingdom",
              "T +44 (0)1600 772297  F +44 (0)1600 551197  M +44 (0)7970 142888",
              "E sales@qliteglobal.com W www.qliteglobal.com",
              "Qlite Ltd, Office 539-540, Tower B3 Spaze i Tech Park, Sohna Road, Gurgaon, INDIA  T +91 124 4264701-08"
            ]
          };
        }
        // Original address for LED Displays and Lighting Controls
        return {
          lines: [
            'Qlite Ltd',
            'Office 539-540, Spaze I Tech Park,',
            'Sohna Road, Gurgaon, Haryana,',
            'INDIA – 122001',
            'E-mail: sales@qliteglobal.com',
            'TEL: +973 3330 8969'
          ]
        };
      case 'bahrain':
      default:
        return {
          lines: [
            'QLITE CO. WLL',
            'CR No.: 82699-01',
            'P.O. Box: 1858',
            'Manama - Kingdom of Bahrain',
            'TEL: +973 17232503  FAX: +973 17242125',
            'E-mail: sales@qliteglobal.com'
          ]
        };
    }
  };

  const exportPDF = async (returnBlob = false): Promise<string | void> => {
    if (isPdfLoading || downloadingType !== null) return;
    setIsPdfLoading(true);

    setDownloadProgress(0);
    setDownloadingType('pdf');
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + 10;
      });
    }, 200);

    try {
      // Check if user is logged in
      if (!session) {
        clearInterval(progressInterval);
        setDownloadingType(null);
        setShowLoginPrompt(true);
        return;
      }

      if (!canDownload) { setShowError(true); return; }

      if (!userInfo.invoiceNo || userInfo.invoiceNo.trim() === '') {
        showToast('Please enter a Project Code before downloading', 'error');
        clearInterval(progressInterval);
        setDownloadingType(null);
        return;
      }

      // Persist quotation + user snapshot in backend
      try {
        const res = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quotationNumber: userInfo.invoiceNo,
            clientName: userInfo.project || userInfo.company || 'Client',
            clientEmail: userInfo.email || session?.user?.email || '',
            products: cart.map(item => ({
              productId: !String((item as any)._id || '').startsWith('custom-')
                ? ((item as any)._id || undefined)
                : undefined,
              sku: item.isDriver 
                ? ((item as any).name || 'Driver')
                : item.sku || '',
              category: item.category || '',
              quantity: item.quantity ?? 1,
              unitPrice: item.price ?? 0,
              totalPrice: (item.price ?? 0) * (item.quantity ?? 1),
              watt: item.watt,
              lumen: (item as any).lumen || '',
              beamAngle: (item as any).beamAngle || '',
              ipRating: Array.isArray(item.ipRating)
                ? item.ipRating.join(', ')
                : item.ipRating || '',
              cct: (item as any).cct || '',
              dimming: (item as any).dimming || '',
              accessories: (item as any).accessories || '',
              finish: (item as any).finish || '',
              reflectorFinish: (item as any).reflectorFinish || '',
              dimension: (item as any).dimension || '',
              isDriver: item.isDriver || false,
              driverName: item.isDriver 
                ? `${(item as any).name || 'Driver'}${(item as any).wattage ? ' - ' + (item as any).wattage + 'W' : ''}`
                : '',
              driverWattage: item.isDriver ? (item as any).wattage || '' : '',
              itemCode: '',
            })),
            totalPrice: total,
            userDepartment: session?.user?.department || '',
            userCountry: session?.user?.country || '',
            userMobile: session?.user?.mobile || userInfo.mobile || '',
            userCompanyName: session?.user?.companyName || userInfo.company || '',
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API error ${res.status}: ${errText}`);
        }
      } catch (err) {
        console.error('Failed to save quotation record:', err);
      }

      // Decide PDF orientation:
      // - If there are any LED display items, keep portrait (existing layout)
      // - If there are only LED lights (no displays), use landscape for a wider table
      const hasDisplayInCart = cart.some(item => !item.isDriver && isDisplayItem(item));
      const orientation: 'portrait' | 'landscape' = hasDisplayInCart ? 'portrait' : 'landscape';

      const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginRight = 20;
      const rightX = pageWidth - marginRight;

      // Add logo on left
      const logoImgData = await fetch('/logo.jpg')
        .then(r => r.arrayBuffer())
        .then(buf => {
          const bytes = new Uint8Array(buf);
          let binary = '';
          bytes.forEach(b => binary += String.fromCharCode(b));
          return btoa(binary);
        });
      doc.addImage(
        'data:image/jpeg;base64,' + logoImgData,
        'JPEG', 14, 10, 60, 50
      );

      // Add headerImage spanning rest of width
      const headerImgData = await fetch('/HEADERIMAGE.jpeg')
        .then(r => r.arrayBuffer())
        .then(buf => {
          const bytes = new Uint8Array(buf);
          let binary = '';
          bytes.forEach(b => binary += String.fromCharCode(b));
          return btoa(binary);
        });
      doc.addImage(
        'data:image/jpeg;base64,' + headerImgData,
        'JPEG', 74, 10, pageWidth - 88, 50
      );

      // Address block with grey-blue background
      const addrY = 62;
      const lineH = 12;
      const addressInfo = getAddressInfo();
      const addrLines = addressInfo.lines;
      const addrHeight = (addrLines.length * lineH) + 10;

      doc.setFillColor(165, 183, 205);
      doc.rect(14, addrY, pageWidth - 28, addrHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      let addrTextY = addrY + 10;
      addrLines.forEach((line: string) => {
        doc.text(line, 18, addrTextY);
        addrTextY += lineH;
      });

      // Table starts after address block
      const tableStartY = addrY + addrHeight;

      // Compute total for PDF using overrides/area logic
      // Total formula (for displays): total = Area(sqm) × Price per sqm (USD) × Quantity,
      // where Area(sqm) matches the suggested-size / cabinet-arrangement logic used elsewhere.
      const computeItemTotalConverted = (item: CartItem): number => {
        const qty = item.quantity ?? 1;
        const overridden = (item as any).customTotalConverted;
        if (typeof overridden === 'number' && overridden > 0) return overridden;

        if (isDisplayItem(item)) {
          const asAny = item as any;
          // requiredLength and requiredWidth are stored in METERS
          const widM = parseFloat(asAny.requiredLength ?? '');
          const heiM = parseFloat(asAny.requiredWidth ?? '');
          const hasWid = !isNaN(widM) && widM > 0;
          const hasHei = !isNaN(heiM) && heiM > 0;

          let areaSqm = 0;
          if (hasWid && hasHei && asAny.cabinetSpecs?.cabinetSize) {
            const sizeStr: string = String(asAny.cabinetSpecs.cabinetSize);
            const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
            if (match) {
              const cabWidMm = parseFloat(match[1]);
              const cabHeiMm = parseFloat(match[2]);
              if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                const cabWidM = cabWidMm / 1000;
                const cabHeiM = cabHeiMm / 1000;
                const cabsWid = widM / cabWidM;
                const cabsHei = heiM / cabHeiM;

                const customRound = (v: number) => {
                  const dec = v - Math.floor(v);
                  return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                };

                const roundedW = customRound(cabsWid);
                const roundedH = customRound(cabsHei);

                const sugWid = roundedW * cabWidM;
                const sugHei = roundedH * cabHeiM;
                areaSqm = sugWid * sugHei;
              }
            }
          }

          // Fallback: width × height if we cannot derive from cabinet size
          if (areaSqm <= 0 && hasWid && hasHei) {
            areaSqm = widM * heiM;
          }

          if (areaSqm > 0) {
            const unitUSD = (item.price ?? 0) * areaSqm;
            const unitConv = convertPrice(unitUSD);
            return unitConv * qty;
          }
        }

        return convertPrice(item.price ?? 0) * qty;
      };
      // Use the same total as shown in the summary (includes screens, controllers, CMS, and discount)
      const pdfTotal = total;

      // Boxes removed as per new LED Lights design

      const pdfCurrency = 'INR';

      const getPrimaryImageUrl = (item: CartItem): string | null => {
        const url = item.productImages?.[0] || item.images?.[0] || null;
        return url || null;
      };

      const getSecondaryImageUrl = (item: CartItem): string | null => {
        const url = item.productImages?.[1] || item.images?.[1] || null;
        return url || null;
      };

      const resolveImageUrl = async (url: string): Promise<string> => {
        try {
          if (url.includes('drive.google.com')) {
            const res = await fetch('/api/resolve-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            if (res.ok) {
              const data = await res.json();
              if (data?.url) return data.url as string;
            }
          }
        } catch { }
        return url;
      };

      const toDataUrl = async (url: string): Promise<string> => {
        const u = await resolveImageUrl(url);

        // For external images (Cloudinary, etc.), use server-side proxy to avoid CORS
        if (u.includes('cloudinary.com') || u.includes('res.cloudinary')) {
          try {
            const res = await fetch('/api/resolve-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: u, returnDataUrl: true })
            });

            if (res.ok) {
              const data = await res.json();
              if (data?.dataUrl) {
                return data.dataUrl;
              }
            }
            // If proxy fails, fall back to placeholder
            console.warn('Proxy failed to return dataUrl, using placeholder');
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
          } catch (error) {
            console.error('Proxy fetch failed, using placeholder:', error);
            // Return placeholder image instead of throwing
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
          }
        }

        // For other URLs, try direct CORS fetch
        try {
          const res = await fetch(u, { mode: 'cors' });
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Direct fetch failed, using placeholder:', error);
          // Return placeholder if direct fetch also fails
          return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
        }
      };

      // Reorganize cart to group drivers with their parent products
      const organizedCart: CartItem[] = [];
      cart.forEach(item => {
        if (!item.isDriver) {
          // Add product
          organizedCart.push(item);
          // Add its drivers right after
          const productDrivers = cart.filter(d => d.isDriver && d.parentProductId === item.cartItemId);
          organizedCart.push(...productDrivers);
        }
      });
      // Add any standalone drivers (without parent)
      const standaloneDrivers = cart.filter(item => item.isDriver && !item.parentProductId);
      organizedCart.push(...standaloneDrivers);

      // Check if cart contains only lighting controls (excluding drivers and displays)
      const hasOnlyLightingControls = organizedCart.every(item =>
        item.isDriver || (item as any).isLightingControl
      );

      // Use different columns for lighting controls
      const columns = hasOnlyLightingControls ? [
        'SI No', 'Image', 'Product Name', 'Description', `Price (${pdfCurrency})`, 'Quantity', `Total (${pdfCurrency})`
      ] : [
        'S.No.', 'Code', 'Description', 'Model No.', 'Image',
        'Unit', 'Quantity', 'Unit Price', 'Total Amount'
      ];

      const imageDataUrls = await Promise.all(
        organizedCart.map(async (item) => {
          const url = getPrimaryImageUrl(item);
          if (!url) return null;
          try { return await toDataUrl(url); } catch { return null; }
        })
      );

      const secondaryImageDataUrls = await Promise.all(
        organizedCart.map(async (item) => {
          const url = getSecondaryImageUrl(item);
          if (!url) return null;
          try { return await toDataUrl(url); } catch { return null; }
        })
      );

      const getScaledImgHeight = (dataUrl: string, targetWidth: number): Promise<number> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const ratio = img.height / img.width;
            resolve(targetWidth * ratio);
          };
          img.onerror = () => resolve(46);
          img.src = dataUrl;
        });
      };

      const targetImgWidth = 46;

      // Helper to normalize special symbols for jsPDF's built-in fonts,
      // so values like ">=1000cd" or "-30℃~+60℃" render correctly instead of corrupting.
      const sanitizePdfText = (value: string): string => {
        return value
          .replace(/≥/g, '>=')
          .replace(/≤/g, '<=')
          .replace(/±/g, '+/-')
          .replace(/℃/g, 'degC')
          .replace(/°/g, 'deg');
      };
      const rowHeights = await Promise.all(
        imageDataUrls.map(async (du) => {
          if (!du) return 0;
          const h = await getScaledImgHeight(du, targetImgWidth);
          return Math.ceil(h + 4);
        })
      );

      // Check if cart contains LED Displays
      const hasDisplays = organizedCart.some(item => !item.isDriver && isDisplayItem(item));
      const hasLights = organizedCart.some(item => !item.isDriver && !isDisplayItem(item));

      // If we have LED Displays, we need to render them differently
      if (hasDisplays && !hasLights) {
        // ALL LED DISPLAYS - Use vertical layout for each display
        let currentY = 170; // start below the header box (which ends at ~155)
        const pageHeight = doc.internal.pageSize.height;

        for (let i = 0; i < organizedCart.length; i++) {
          const item = organizedCart[i];
          if (item.isDriver) continue; // Skip drivers for now

          const boxX = 14;
          const boxWidth = pageWidth - 28;
          const leftColWidth = boxWidth * 0.68; // ~68% for specs (slightly narrower)
          const rightColWidth = boxWidth * 0.32; // ~32% for image (wider for larger photos)

          const asAny = item as any;

          // Define all fields for LED Display including Module, Cabinet and Screen specs,
          // grouped into sections matching the admin panel order
          type DisplayField = { label: string; value: string; isSection?: boolean; rightLabel?: string; rightValue?: string };

          // Helper function to pair items into two columns
          const pairItems = (items: DisplayField[]): DisplayField[] => {
            const paired: DisplayField[] = [];
            const leftCount = Math.ceil(items.length / 2);
            for (let idx = 0; idx < leftCount; idx++) {
              const left = items[idx];
              const right = items[leftCount + idx];
              paired.push({
                label: left.label,
                value: left.value,
                rightLabel: right?.label,
                rightValue: right?.value,
              });
            }
            return paired;
          };

          // Basic Information items (10 items -> 5 left, 5 right)
          const basicInfoItems: DisplayField[] = [
            { label: 'SI No', value: (i + 1).toString() },
            { label: 'Model Number', value: item.sku ?? 'N/A' },
            { label: 'Category', value: item.category ?? 'N/A' },
            { label: 'Application', value: item.application ?? 'N/A' },
            { label: 'IP Rating', value: typeof asAny.ipRating === 'string' ? asAny.ipRating : (Array.isArray(asAny.ipRating) ? asAny.ipRating.join(', ') : 'N/A') },
            // Removed from Basic Information as requested: Pixel Pitch, Total Resolution, Square Feet, Price (USD)
          ];

          // Module Specifications items (5 items -> 3 left, 2 right)
          const moduleSpecItems: DisplayField[] = [
            { label: '1. Pixel Pitch', value: asAny.moduleSpecs?.pixelPitch ?? 'N/A' },
            // Match Edit LED Display: Pixel Configuration auto-synced from Screen Resolution (Total Resolution)
            { label: '2. Pixel Configuration', value: asAny.moduleSpecs?.pixelConfiguration || asAny.totalResolution || 'N/A' },
            { label: '3. Module Resolution', value: asAny.moduleSpecs?.moduleResolution ?? 'N/A' },
            { label: '4. Module Size (mm)', value: asAny.moduleSpecs?.moduleSize ?? 'N/A' },
            { label: '5. Module Weight (kg)', value: asAny.moduleSpecs?.moduleWeight != null ? asAny.moduleSpecs.moduleWeight.toString() : 'N/A' },
          ];

          // Determine selected cabinet material variant (if any) for PDF specs
          const materialVariants = Array.isArray(asAny.cabinetMaterialVariants)
            ? (asAny.cabinetMaterialVariants as any[])
            : undefined;
          const selectedMaterialName = (asAny as any).selectedCabinetMaterial as string | undefined;
          let selectedVariant: any | undefined;
          if (materialVariants && materialVariants.length > 0) {
            if (selectedMaterialName) {
              selectedVariant = materialVariants.find((v) => v.material === selectedMaterialName) || materialVariants[0];
            } else {
              selectedVariant = materialVariants[0];
            }
          }

          const effectiveMaterialName: string =
            (selectedVariant && selectedVariant.material) || asAny.cabinetSpecs?.material || 'N/A';
          const effectiveMaterialPrice: number | undefined =
            selectedVariant && typeof selectedVariant.price === 'number' ? selectedVariant.price : undefined;
          const effectiveCabinetWeight: number | undefined =
            selectedVariant && typeof selectedVariant.cabinetWeight === 'number'
              ? selectedVariant.cabinetWeight
              : (typeof asAny.cabinetSpecs?.cabinetWeight === 'number' ? asAny.cabinetSpecs.cabinetWeight : undefined);

          // Cabinet Specifications items (8 items -> 4 left, 4 right)
          // Use the selected cabinet material variant (if present) for Material and Cabinet Weight.
          const cabinetSpecItems: DisplayField[] = [
            { label: '1. Cabinet Size (W*H)', value: asAny.cabinetSpecs?.cabinetSize ?? 'N/A' },
            { label: '2. Cabinet Resolution', value: asAny.cabinetSpecs?.cabinetResolution ?? 'N/A' },
            { label: '3. Module Quantity', value: asAny.cabinetSpecs?.moduleQuantity != null ? asAny.cabinetSpecs.moduleQuantity.toString() : 'N/A' },
            { label: '4. Pixel Density', value: asAny.cabinetSpecs?.pixelDensity ?? 'N/A' },
            { label: '5. Cabinet Weight (kg)', value: effectiveCabinetWeight != null ? effectiveCabinetWeight.toString() : 'N/A' },
            { label: '6. Cabinet Area (sqm)', value: asAny.cabinetSpecs?.cabinetArea != null ? asAny.cabinetSpecs.cabinetArea.toString() : 'N/A' },
            { label: '7. Material', value: effectiveMaterialName },
            { label: '8. Maintenance', value: asAny.cabinetSpecs?.maintenance ?? 'N/A' },
          ];

          // Screen Parameters items (17 items -> 9 left, 8 right)
          const screenParamItems: DisplayField[] = [
            { label: '1. Brightness Control', value: asAny.screenParams?.brightnessControl ?? 'N/A' },
            { label: '2. White Balance Brightness', value: asAny.screenParams?.whiteBalanceBrightness ?? 'N/A' },
            { label: '3. Color Temperature', value: asAny.screenParams?.colorTemperature ?? 'N/A' },
            { label: '4. Best Viewing Distance', value: asAny.screenParams?.bestViewingDistance ?? 'N/A' },
            { label: '5. Brightness Uniformity', value: asAny.screenParams?.brightnessUniformity ?? 'N/A' },
            { label: '6. Color Uniformity', value: asAny.screenParams?.colorUniformity ?? 'N/A' },
            { label: '7. Protective Grade', value: asAny.screenParams?.protectiveGrade ?? 'N/A' },
            { label: '8. View Angle', value: asAny.screenParams?.viewAngle ?? 'N/A' },
            { label: '9. Defects Rate', value: asAny.screenParams?.defectsRate ?? 'N/A' },
            { label: '10. Frame Frequency', value: asAny.screenParams?.frameFrequency ?? 'N/A' },
            { label: '11. Refresh Rate', value: asAny.screenParams?.refreshRate ?? 'N/A' },

            { label: '13. Max Power Consumption', value: asAny.screenParams?.maxPowerConsumption ?? 'N/A' },
            { label: '14. Avg Power Consumption', value: asAny.screenParams?.avgPowerConsumption ?? 'N/A' },
            { label: '15. Life Span', value: asAny.screenParams?.lifeSpan ?? 'N/A' },
            { label: '16. Temperature-Operating', value: asAny.screenParams?.temperatureOperating ?? 'N/A' },
            { label: '17. Humidity-Operating', value: asAny.screenParams?.humidityOperating ?? 'N/A' },
          ];

          const displayFields: DisplayField[] = [
            // Basic Information
            { label: 'Basic Information', value: '', isSection: true },
            ...pairItems(basicInfoItems),

            // Module Specifications
            { label: 'Module Specifications', value: '', isSection: true },
            ...pairItems(moduleSpecItems),

            // Cabinet Specifications
            { label: 'Cabinet Specifications', value: '', isSection: true },
            ...pairItems(cabinetSpecItems),

            // Screen Parameters (9 left, 8 right)
            { label: 'Screen Parameters', value: '', isSection: true },
            ...pairItems(screenParamItems),

          ];

          const rowHeight = 16; // fixed safe height
          const bottomMargin = 40;

          let startIndex = 0;
          let isFirstSlice = true;

          while (startIndex < displayFields.length) {
            const remainingRows = displayFields.length - startIndex;
            const availableHeight = pageHeight - bottomMargin - currentY;
            let rowsThisPage = Math.floor(availableHeight / rowHeight);

            if (rowsThisPage <= 0) {
              // No space left on this page, go to next page
              doc.addPage();
              currentY = 40;
              continue;
            }

            if (rowsThisPage > remainingRows) {
              rowsThisPage = remainingRows;
            }

            const slice = displayFields.slice(startIndex, startIndex + rowsThisPage);
            const sliceHeight = slice.length * rowHeight;

            // Draw outer box for this slice
            doc.setLineWidth(1.5);
            doc.setDrawColor(0, 0, 0);
            doc.rect(boxX, currentY, boxWidth, sliceHeight);

            // Draw vertical line separating specs from image
            const specsRightX = boxX + leftColWidth;
            doc.line(specsRightX, currentY, specsRightX, currentY + sliceHeight);

            // Inner vertical line to split into two columns (but skip section header rows)
            const innerColX = boxX + leftColWidth / 2;
            let prevY = currentY;
            for (let r = 0; r < slice.length; r++) {
              const field = slice[r];
              const rowY = currentY + (r * rowHeight);
              const nextRowY = currentY + ((r + 1) * rowHeight);

              // Draw inner vertical line only for non-section rows
              if (!field.isSection) {
                doc.line(innerColX, rowY, innerColX, nextRowY);
              }
            }

            // Draw horizontal lines for each row in this slice (spec side only)
            for (let r = 1; r < slice.length; r++) {
              doc.line(boxX, currentY + (r * rowHeight), boxX + leftColWidth, currentY + (r * rowHeight));
            }

            // Fill in labels and values (supporting optional right-side label/value)
            doc.setFontSize(7);
            const leftLabelX = boxX + 3;
            const leftValueX = boxX + 105;
            const rightLabelX = innerColX + 3;
            const rightValueX = innerColX + 105;
            const leftMaxWidth = (innerColX - boxX) - 105 - 5;
            const rightMaxWidth = (specsRightX - innerColX) - 105 - 5;

            for (let f = 0; f < slice.length; f++) {
              const field = slice[f];
              const rowTopY = currentY + (f * rowHeight);
              const fieldY = rowTopY + rowHeight * 0.7;

              if (field.isSection) {
                // Section header - colored band with bold blue text
                const sectionX = boxX;
                const sectionW = leftColWidth;
                // Light blue background behind the section row
                doc.setFillColor(230, 240, 255); // very light blue
                doc.setDrawColor(200, 220, 255);
                doc.rect(sectionX, rowTopY, sectionW, rowHeight, 'F');

                // Header text
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(30, 64, 175); // dark blue
                const sectionCenterX = boxX + leftColWidth / 2;
                doc.text(field.label, sectionCenterX, fieldY, { align: 'center' });

                // Restore defaults for non-section rows
                doc.setFontSize(7);
                doc.setTextColor(0, 0, 0);
                doc.setDrawColor(0, 0, 0);
              } else {
                // Left Label
                doc.setFont('helvetica', 'bold');
                doc.text(sanitizePdfText(field.label + ':'), leftLabelX, fieldY);

                // Left Value
                doc.setFont('helvetica', 'normal');
                const leftRaw = field.value;
                const leftText = sanitizePdfText(leftRaw);
                const wrappedLeft = doc.splitTextToSize(leftText, leftMaxWidth);
                doc.text(wrappedLeft[0] || leftText, leftValueX, fieldY);

                // Right side (for paired rows)
                if (field.rightLabel) {
                  // Right label
                  doc.setFont('helvetica', 'bold');
                  doc.text(sanitizePdfText(field.rightLabel + ':'), rightLabelX, fieldY);

                  // Right value
                  doc.setFont('helvetica', 'normal');
                  const rightRaw = field.rightValue || 'N/A';
                  const rightText = sanitizePdfText(rightRaw);
                  const wrappedRight = doc.splitTextToSize(rightText, rightMaxWidth);
                  doc.text(wrappedRight[0] || rightText, rightValueX, fieldY);
                }
              }
            }

            // Add image(s) only on the first slice for this item
            if (isFirstSlice) {
              const primaryImageUrl = getPrimaryImageUrl(item);
              const secondaryImageUrl = getSecondaryImageUrl(item);
              const imgX = boxX + leftColWidth + 10;
              const imgY = currentY + 10;
              const imgMaxWidth = rightColWidth - 20;
              const imgMaxHeight = sliceHeight - 20;

              const primaryDataUrl = imageDataUrls[i];
              const secondaryDataUrl = secondaryImageDataUrls[i];

              // If we have both images, display them stacked vertically (top & bottom)
              if (primaryDataUrl && secondaryDataUrl) {
                const singleImgHeight = (imgMaxHeight - 2) / 2; // Split height with very small gap
                const availableWidth = imgMaxWidth;

                try {
                  // Add first image (top)
                  const img1 = new Image();
                  await new Promise((resolve) => {
                    img1.onload = resolve;
                    img1.src = primaryDataUrl;
                  });

                  const aspectRatio1 = img1.width / img1.height;
                  let imgWidth1 = availableWidth;
                  let imgHeight1 = imgWidth1 / aspectRatio1;

                  if (imgHeight1 > singleImgHeight) {
                    imgHeight1 = singleImgHeight;
                    imgWidth1 = imgHeight1 * aspectRatio1;
                  }

                  const imgCenterX1 = imgX + (availableWidth - imgWidth1) / 2;
                  const imgCenterY1 = imgY + (singleImgHeight - imgHeight1) / 2;

                  doc.addImage(primaryDataUrl, 'JPEG', imgCenterX1, imgCenterY1, imgWidth1, imgHeight1);

                  // Add second image (bottom)
                  const img2 = new Image();
                  await new Promise((resolve) => {
                    img2.onload = resolve;
                    img2.src = secondaryDataUrl;
                  });

                  const aspectRatio2 = img2.width / img2.height;
                  let imgWidth2 = availableWidth;
                  let imgHeight2 = imgWidth2 / aspectRatio2;

                  if (imgHeight2 > singleImgHeight) {
                    imgHeight2 = singleImgHeight;
                    imgWidth2 = imgHeight2 * aspectRatio2;
                  }

                  const imgCenterX2 = imgX + (availableWidth - imgWidth2) / 2;
                  const imageGap = 4; // minimal clean gap between images
                  const firstBottomY = imgCenterY1 + imgHeight1 / 2;
                  const imgCenterY2 = firstBottomY + imageGap + imgHeight2 / 2;

                  doc.addImage(secondaryDataUrl, 'JPEG', imgCenterX2, imgCenterY2, imgWidth2, imgHeight2);
                } catch (error) {
                  console.error('Error adding images:', error);
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(150);
                  doc.text('Images Error', imgX + imgMaxWidth / 2, imgY + imgMaxHeight / 2, { align: 'center' });
                  doc.setTextColor(0);
                }
              }
              // If we have only one image, display it centered
              else if (primaryDataUrl || secondaryDataUrl) {
                const dataUrl = primaryDataUrl || secondaryDataUrl;
                try {
                  const img = new Image();
                  await new Promise((resolve) => {
                    img.onload = resolve;
                    img.src = dataUrl!;
                  });

                  const aspectRatio = img.width / img.height;
                  let imgWidth = imgMaxWidth;
                  let imgHeight = imgWidth / aspectRatio;

                  if (imgHeight > imgMaxHeight) {
                    imgHeight = imgMaxHeight;
                    imgWidth = imgHeight * aspectRatio;
                  }

                  const imgCenterX = imgX + (imgMaxWidth - imgWidth) / 2;
                  const imgCenterY = imgY + (imgMaxHeight - imgHeight) / 2;

                  doc.addImage(dataUrl!, 'JPEG', imgCenterX, imgCenterY, imgWidth, imgHeight);
                } catch (error) {
                  console.error('Error adding image:', error);
                  doc.setFontSize(10);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(150);
                  doc.text('No Image', imgX + imgMaxWidth / 2, imgY + imgMaxHeight / 2, { align: 'center' });
                  doc.setTextColor(0);
                }
              }
              // No images available
              else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150);
                doc.text('No Image', imgX + imgMaxWidth / 2, imgY + imgMaxHeight / 2, { align: 'center' });
                doc.setTextColor(0);
              }
            }

            isFirstSlice = false;
            startIndex += rowsThisPage;
            currentY += sliceHeight + 5; // minimal gap before quotation table
          }

          // Draw new QUOTATION table with 7 columns, including spare & accessories as additional rows
          {
            const METER_TO_FEET = 1 / 0.3048;
            // requiredLength and requiredWidth are now stored in METERS
            const widM = parseFloat(asAny.requiredLength ?? '');
            const heiM = parseFloat(asAny.requiredWidth ?? '');
            const toFt = (m: number) => (m * METER_TO_FEET);
            const fmt = (m: number) => m.toFixed(2);
            const hasWid = !isNaN(widM) && widM > 0;
            const hasHei = !isNaN(heiM) && heiM > 0;

            // Calculate values for the main screen row
            const requestSizeFt = hasWid && hasHei ? `${toFt(widM).toFixed(2)}' × ${toFt(heiM).toFixed(2)}'` : 'N/A';
            const requestSizeM = hasWid && hasHei ? `${fmt(widM)}m × ${fmt(heiM)}m` : 'N/A';
            // Use the suggested size entered in Edit LED Display Specifications if available; fallback to request size
            const suggestedSizeM = asAny.suggestedSize
              ? String(asAny.suggestedSize)
              : requestSizeM;
            const cabinetCount = asAny.cabinetRequired != null ? String(asAny.cabinetRequired) : 'N/A';

            // Area (sqm) for PDF: match the Price Calculation panel logic based on suggested size / cabinet arrangement.
            // Try to derive area from cabinet size and rounded cabinet arrangement; fallback to width×height if needed.
            let areaSqm = 0;
            if (hasWid && hasHei && asAny.cabinetSpecs?.cabinetSize) {
              const sizeStr: string = String(asAny.cabinetSpecs.cabinetSize);
              const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
              if (match) {
                const cabWidMm = parseFloat(match[1]);
                const cabHeiMm = parseFloat(match[2]);
                if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                  const cabWidM = cabWidMm / 1000;
                  const cabHeiM = cabHeiMm / 1000;
                  const cabsWid = widM / cabWidM;
                  const cabsHei = heiM / cabHeiM;

                  const customRound = (v: number) => {
                    const dec = v - Math.floor(v);
                    return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                  };

                  const roundedW = customRound(cabsWid);
                  const roundedH = customRound(cabsHei);

                  const sugWid = roundedW * cabWidM;
                  const sugHei = roundedH * cabHeiM;
                  areaSqm = sugWid * sugHei;
                }
              }
            }

            // Fallback: if we could not derive area from cabinet size, use width×height.
            if (areaSqm <= 0 && hasWid && hasHei) {
              areaSqm = widM * heiM;
            }
            const qty = (item.quantity ?? 1);
            const totalConv = computeItemTotalConverted(item);
            const totalText = totalConv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Build spare & accessories rows
            type SpareRow = { label: string; qty: string; price?: number };
            const spareRows: SpareRow[] = [];

            const rawSpareModules = asAny.spareModules;
            // Always show Spare Modules row; default to N/A when not provided
            spareRows.push({
              label: 'Spare modules (3% of total modules)',
              qty: rawSpareModules != null && rawSpareModules !== '' ? String(rawSpareModules) : 'N/A',
            });

            const parseNameQty = (raw: string | undefined | null) => {
              if (!raw) return { name: '', qty: '' };
              const str = String(raw);
              const parts = str.split(' - ');
              if (parts.length >= 2) {
                const maybeQty = parts[parts.length - 1].trim();
                const namePart = parts.slice(0, parts.length - 1).join(' - ').trim();
                return { name: namePart, qty: maybeQty };
              }
              return { name: '', qty: str };
            };

            const { name: psuName, qty: psuQty } = parseNameQty(asAny.sparePSU);
            // Always show Spare PSU row; default to N/A when not provided
            spareRows.push({
              label: psuName ? `Spare PSU: ${psuName}` : 'Spare PSU',
              qty:
                (psuQty && psuQty.trim() !== '')
                  ? psuQty
                  : (asAny.sparePSU != null && String(asAny.sparePSU).trim() !== ''
                    ? String(asAny.sparePSU)
                    : 'N/A'),
            });

            const rawReceiving = asAny.spareReceivingCard;
            // Always show Spare Receiving Card row; default to N/A when not provided
            spareRows.push({
              label: 'Spare receiving card',
              qty: rawReceiving != null && rawReceiving !== '' ? String(rawReceiving) : 'N/A',
            });

            const { name: pkgName, qty: pkgQty } = parseNameQty(asAny.package);
            // Always show Package row; default to N/A when not provided
            spareRows.push({
              label: pkgName ? `Package: ${pkgName}` : 'Package',
              qty:
                (pkgQty && pkgQty.trim() !== '')
                  ? pkgQty
                  : (asAny.package != null && String(asAny.package).trim() !== ''
                    ? String(asAny.package)
                    : 'N/A'),
            });

            // Controller 1: always show row; default to N/A when no value is entered
            const hasController1Name = !!(asAny.controller1Name && String(asAny.controller1Name).trim() !== '');
            const hasController1Qty = typeof asAny.controller1Qty === 'number' && asAny.controller1Qty > 0;
            const hasController1Price = typeof asAny.controller1Price === 'number' && asAny.controller1Price > 0;
            const hasController1Any = hasController1Name || hasController1Qty || hasController1Price;

            if (hasController1Any) {
              const controller1PriceConverted = hasController1Price ? convertPrice(asAny.controller1Price) : undefined;
              spareRows.push({
                label: hasController1Name ? `Controller 1: ${asAny.controller1Name}` : 'Controller 1',
                qty: hasController1Qty ? String(asAny.controller1Qty) : 'N/A',
                price: controller1PriceConverted,
              });
            } else {
              spareRows.push({
                label: 'Controller 1: N/A',
                qty: 'N/A',
              });
            }

            // Controller 2:
            // - If any of name / qty / price are present, render a row (with N/A for missing pieces)
            // - If completely empty, always render an explicit "Controller 2: N/A" row
            const hasController2Name = !!(asAny.controller2Name && String(asAny.controller2Name).trim() !== '');
            const hasController2Qty = typeof asAny.controller2Qty === 'number' && asAny.controller2Qty > 0;
            const hasController2Price = typeof asAny.controller2Price === 'number' && asAny.controller2Price > 0;
            const hasController2Any = hasController2Name || hasController2Qty || hasController2Price;

            if (hasController2Any) {
              const controller2PriceConverted = hasController2Price ? convertPrice(asAny.controller2Price) : undefined;
              spareRows.push({
                label: hasController2Name ? `Controller 2: ${asAny.controller2Name}` : 'Controller 2',
                qty: hasController2Qty ? String(asAny.controller2Qty) : 'N/A',
                price: controller2PriceConverted,
              });
            } else {
              spareRows.push({
                label: 'Controller 2: N/A',
                qty: 'N/A',
              });
            }

            // Additional spare / accessory information rows
            // These are informational and use fixed "as per site requirement" quantity text
            spareRows.push({
              label: 'Main Power 3-phase Cable — connect to the nearby power distribution room',
              qty: 'As per site requirement',
            });

            spareRows.push({
              label: 'Fibre Cable from Control Room',
              qty: 'As per site requirement',
            });

            spareRows.push({
              label: 'Power Distributor Box / Signal Fibre Cable',
              qty: 'As per site requirement',
            });

            spareRows.push({
              label: 'Equipment Rack for Controller',
              qty: 'As per site requirement',
            });

            // CMS with license duration: add row when included
            if (asAny.cmsInclude && String(asAny.cmsInclude).toLowerCase() === 'yes') {
              const years = asAny.cmsLicenseYears || 3;
              const priceMap: { [key: number]: number } = { 1: 125, 3: 375, 5: 625, 7: 875 };
              const cmsPriceUSD = priceMap[years] || 375;
              const cmsPriceConverted = convertPrice(cmsPriceUSD);
              spareRows.push({
                label: `CMS (Content Management System) - ${years} Year License`,
                qty: '1',
                price: cmsPriceConverted,
              });
            }

            // MS Structure Fabrication and Installation at Site: use area in sqm if provided
            if (typeof asAny.msStructureSqm === 'number' && asAny.msStructureSqm > 0) {
              spareRows.push({
                label: 'MS Structure Fabrication and Installation at Site',
                qty: `${asAny.msStructureSqm.toFixed(2)} sqm`,
              });
            }

            // Split spare rows into two groups:
            // - firstTableSpareRows: up to and including Controller 2 (stay on first page)
            // - extraSpareRows: remaining accessories (start from second page)
            const controller2Index = spareRows.findIndex((row) => row.label.startsWith('Controller 2'));
            const splitIndex = controller2Index === -1 ? spareRows.length : controller2Index + 1;
            const firstTableSpareRows = spareRows.slice(0, splitIndex);
            const extraSpareRows = spareRows.slice(splitIndex);

            // Table dimensions
            const tableX = boxX;
            const tableWidth = pageWidth - 28; // Full width
            const headerHeight = 25;
            const mainRowHeight = 90; // increased to fit multi-line content (incl. cabinet arrangement & resolution)
            const spareRowHeight = 20; // more compact rows for accessories
            const totalRowsHeight = mainRowHeight + spareRowHeight * firstTableSpareRows.length;
            const totalTableHeight = headerHeight + totalRowsHeight;

            // Page break if needed, using the same bottomMargin convention as the spec/details box
            if (currentY + totalTableHeight > pageHeight - bottomMargin) {
              doc.addPage();
              currentY = 40;
            }

            // Draw QUOTATION header with colored bar
            doc.setLineWidth(1.5);
            doc.setDrawColor(15, 76, 129); // deep blue border
            doc.setFillColor(15, 76, 129); // deep blue fill
            doc.rect(tableX, currentY, tableWidth, headerHeight, 'FD'); // fill + stroke
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255); // white title text
            doc.text('QUOTATION', tableX + tableWidth / 2, currentY + headerHeight / 2 + 5, { align: 'center' });
            // Restore text color for body content
            doc.setTextColor(0, 0, 0);

            // Column widths (7 columns)
            // Slightly reduce Type & Screen Info, increase Price column width.
            const colWidths = [
              tableWidth * 0.06,  // Item (narrower)
              tableWidth * 0.18,  // Equipment Name
              tableWidth * 0.22,  // Type (slightly reduced)
              tableWidth * 0.22,  // Screen Info (slightly reduced)
              tableWidth * 0.08,  // Quantity
              tableWidth * 0.08,  // Area
              tableWidth * 0.16   // Price (wider)
            ];

            const columnHeaders = ['Item', 'Equipment Name', 'Type', 'Screen Info', 'Quantity', 'Area', 'Price'];

            // Draw table structure
            let currentX = tableX;
            const tableY = currentY + headerHeight;

            // Draw outer border for all data rows (main + spare)
            doc.rect(tableX, tableY, tableWidth, totalRowsHeight);

            // Draw vertical lines for columns.
            // For the boundaries between Equipment Name, Type, and Screen Info (indexes 2 and 3),
            // only draw down to the bottom of the main row so the spare rows visually have
            // a single merged box for those three columns.
            for (let i = 0; i < colWidths.length; i++) {
              if (i > 0) {
                const lineX = currentX;
                const isMiddleMergeBoundary = i === 2 || i === 3; // between col1-2 and col2-3
                const lineBottomY = isMiddleMergeBoundary
                  ? tableY + mainRowHeight
                  : tableY + totalRowsHeight;
                doc.line(lineX, tableY, lineX, lineBottomY);
              }
              currentX += colWidths[i];
            }

            // Draw column headers with subtle tinted background
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            // Header background band
            doc.setFillColor(230, 240, 255); // very light blue
            doc.rect(tableX, tableY, tableWidth, 12, 'F');
            // Column header text
            currentX = tableX;
            for (let i = 0; i < columnHeaders.length; i++) {
              const centerX = currentX + colWidths[i] / 2;
              // All headers, including Screen Info, use the same blue color
              doc.setTextColor(30, 64, 175); // dark blue text
              doc.text(columnHeaders[i], centerX, tableY + 8, { align: 'center' });
              currentX += colWidths[i];
            }
            // Restore default text color for data rows
            doc.setTextColor(0, 0, 0);

            // Horizontal line after headers
            doc.line(tableX, tableY + 12, tableX + tableWidth, tableY + 12);

            // Horizontal line after main row
            const mainRowBottomY = tableY + mainRowHeight;
            doc.line(tableX, mainRowBottomY, tableX + tableWidth, mainRowBottomY);

            // Horizontal lines between spare rows (if any) for first table group
            for (let s = 1; s < firstTableSpareRows.length; s++) {
              const y = mainRowBottomY + s * spareRowHeight;
              doc.line(tableX, y, tableX + tableWidth, y);
            }

            // Fill in main data row (Item 1)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            currentX = tableX;

            const cabW = (item as any).cabinetArrangementWidth as number | undefined;
            const cabH = (item as any).cabinetArrangementHeight as number | undefined;
            const cabinetArrangementLine = (cabW && cabH)
              ? `Cabinet Arrangement: W${cabW} × H${cabH} (${cabinetCount} cabinets)`
              : `Cabinet Arrangement: ${cabinetCount} cabinets`;
            const cabinetArrangementValueLine = (cabW && cabH)
              ? `W${cabW} × H${cabH} (${cabinetCount} cabinets)`
              : `${cabinetCount} cabinets`;
            const hasResolution = !!(item.totalResolution && item.totalResolution.trim() !== '');
            const screenResolutionLine = hasResolution
              ? `Screen Resolution: ${item.totalResolution}`
              : 'Screen Resolution: N/A';
            const screenResolutionValueLine = hasResolution
              ? item.totalResolution!
              : 'N/A';

            const mainRowData = [
              '1', // Item - main screen
              item.sku || 'N/A', // Equipment Name - SKU
              `Request Size (Ft)\nRequest Size (M)\nSuggested Size (M)\nCabinet Arrangement\nScreen Resolution`, // Type (labels only)
              `${requestSizeFt}\n${requestSizeM}\n${suggestedSizeM}\n${cabinetArrangementValueLine}\n${screenResolutionValueLine}`, // Screen Info (values only)
              String(qty), // Quantity: number of screens selected
              areaSqm > 0 ? `${fmt(areaSqm)} m²` : 'N/A', // Area
              `${pdfCurrency} ${totalText}` // Total Price
            ];

            for (let i = 0; i < mainRowData.length; i++) {
              const centerX = currentX + colWidths[i] / 2;

              // Always use black text for data cells
              doc.setTextColor(0, 0, 0);

              // Handle multi-line text for Type and Screen Info columns with sub-box borders
              if (i === 2 || i === 3) {
                const lines = mainRowData[i].split('\n');
                const cellTop = tableY + 12; // data area starts after header separator
                const cellBottom = tableY + mainRowHeight;
                const cellHeight = cellBottom - cellTop;
                const segmentCount = lines.length;
                const segmentHeight = cellHeight / segmentCount;

                const colLeft = currentX;
                const colRight = currentX + colWidths[i];

                // For the Screen Info column (index 3), fill the entire cell with a light brown background
                if (i === 3) {
                  doc.setFillColor(255, 236, 214); // light brown-ish background
                  doc.rect(colLeft, cellTop, colRight - colLeft, cellHeight, 'F');
                  doc.setDrawColor(0, 0, 0); // ensure borders stay black
                }

                // Draw horizontal lines inside this column to create sub-boxes
                for (let j = 1; j < segmentCount; j++) {
                  const lineY = cellTop + segmentHeight * j;
                  doc.line(colLeft, lineY, colRight, lineY);
                }

                // Center each line of text inside its sub-box
                for (let j = 0; j < segmentCount; j++) {
                  const textY = cellTop + segmentHeight * j + segmentHeight / 2 + 2;
                  doc.text(lines[j], centerX, textY, { align: 'center' });
                }
              } else {
                // For single-line columns, center vertically in the cell
                const cellY = tableY + (mainRowHeight / 2) + 3;
                doc.text(mainRowData[i], centerX, cellY, { align: 'center' });
              }
              currentX += colWidths[i];
            }

            // Fill in primary spare & accessories rows as additional items (2, 3, ...)
            for (let index = 0; index < firstTableSpareRows.length; index++) {
              const spare = firstTableSpareRows[index];
              const rowTop = mainRowBottomY + index * spareRowHeight;
              const rowCenterY = rowTop + spareRowHeight / 2 + 2;

              let colX = tableX;

              // Column 0: Item number (2, 3, ...)
              const itemCenterX = colX + colWidths[0] / 2;
              doc.text(String(index + 2), itemCenterX, rowCenterY, { align: 'center' });
              colX += colWidths[0];

              // Columns 1-3 merged logically: Equipment Name + Type + Screen Info
              const mergedWidth = colWidths[1] + colWidths[2] + colWidths[3];
              const mergedTextX = colX + 2; // minimal left padding inside merged box
              doc.text(sanitizePdfText(spare.label), mergedTextX, rowCenterY, { align: 'left' });
              colX += mergedWidth;

              // Column 4: Quantity
              const qtyCenterX = colX + colWidths[4] / 2;
              doc.text(spare.qty, qtyCenterX, rowCenterY, { align: 'center' });
              colX += colWidths[4];

              // Column 5: Area
              // For specific spare/controller items, show "Unit"; otherwise leave blank.
              {
                const areaCenterX = colX + colWidths[5] / 2;
                const label = spare.label || '';
                const isUnitAreaItem =
                  label.startsWith('Spare modules (3% of total modules)') ||
                  label.startsWith('Spare PSU') ||
                  label.startsWith('Spare receiving card') ||
                  label.startsWith('Package') ||
                  label.startsWith('Controller 1') ||
                  label.startsWith('Controller 2');

                if (isUnitAreaItem) {
                  doc.text('Unit', areaCenterX, rowCenterY, { align: 'center' });
                }
              }
              colX += colWidths[5];

              // Column 6: Price
              // For specific spare items, always show "Included".
              // Otherwise, if a numeric price exists, show the calculated total.
              {
                const priceCenterX = colX + colWidths[6] / 2;
                const label = spare.label || '';
                const isIncludedItem =
                  label.startsWith('Spare modules (3% of total modules)') ||
                  label.startsWith('Spare PSU') ||
                  label.startsWith('Spare receiving card') ||
                  label.startsWith('Package');

                if (isIncludedItem) {
                  doc.text('Included', priceCenterX, rowCenterY, { align: 'center' });
                } else if (spare.price !== undefined) {
                  const rawQty = spare.qty != null ? String(spare.qty) : '';
                  const qtyNumber = parseFloat(rawQty.split(' ')[0]);
                  const unitPrice = spare.price;
                  const totalPrice = !isNaN(qtyNumber) ? unitPrice * qtyNumber : unitPrice;
                  const priceText = totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  doc.text(priceText, priceCenterX, rowCenterY, { align: 'center' });
                }
              }
            }

            currentY += totalTableHeight + 15;

            // If there are extra spare rows (beyond Novastar Controller), render them
            // on a new page in a separate QUOTATION table.
            if (extraSpareRows.length > 0) {
              doc.addPage();
              currentY = 40;

              const extraTableX = boxX;
              const extraTableWidth = pageWidth - 28;
              const extraHeaderHeight = 25;
              const extraRowHeight = 20;
              // Include the 12pt header band plus all data rows inside the outer border
              const extraRowsHeight = 12 + extraRowHeight * extraSpareRows.length;
              const extraTotalHeight = extraHeaderHeight + extraRowsHeight;

              // Draw QUOTATION header on second page
              doc.setLineWidth(1.5);
              doc.setDrawColor(15, 76, 129);
              doc.setFillColor(15, 76, 129);
              doc.rect(extraTableX, currentY, extraTableWidth, extraHeaderHeight, 'FD');
              doc.setFontSize(15);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(255, 255, 255);
              doc.text('QUOTATION', extraTableX + extraTableWidth / 2, currentY + extraHeaderHeight / 2 + 5, { align: 'center' });
              doc.setTextColor(0, 0, 0);

              // Column widths (reuse same proportions as first table)
              // Slightly reduce Type & Screen Info, increase Price column width.
              const extraColWidths = [
                extraTableWidth * 0.06,  // Item (narrower)
                extraTableWidth * 0.18,  // Equipment Name
                extraTableWidth * 0.22,  // Type (slightly reduced)
                extraTableWidth * 0.22,  // Screen Info (slightly reduced)
                extraTableWidth * 0.08,  // Quantity
                extraTableWidth * 0.08,  // Area
                extraTableWidth * 0.16,  // Price (wider)
              ];
              const extraColumnHeaders = ['Item', 'Equipment Name', 'Type', 'Screen Info', 'Quantity', 'Area', 'Price'];

              let extraX = extraTableX;
              const extraTableY = currentY + extraHeaderHeight;

              // Outer border
              doc.rect(extraTableX, extraTableY, extraTableWidth, extraRowsHeight);

              // Vertical lines for all columns.
              // - For Equipment / Type / Screen Info boundaries (indexes 2 and 3),
              //   draw only through the header band so the data rows appear merged.
              // - Skip the boundary between Quantity and Area (index 5) entirely so
              //   those two columns are visually merged as well.
              for (let i = 0; i < extraColWidths.length; i++) {
                if (i > 0) {
                  const isMiddleMergeBoundary = i === 2 || i === 3; // Equipment/Type and Type/Screen Info
                  const isQtyAreaBoundary = i === 5; // between Quantity and Area
                  if (!isQtyAreaBoundary) {
                    const lineBottomY = isMiddleMergeBoundary
                      ? extraTableY + 12 // stop at bottom of header band
                      : extraTableY + extraRowsHeight;
                    doc.line(extraX, extraTableY, extraX, lineBottomY);
                  }
                }
                extraX += extraColWidths[i];
              }

              // Header band and text
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.setFillColor(230, 240, 255);
              doc.rect(extraTableX, extraTableY, extraTableWidth, 12, 'F');
              extraX = extraTableX;
              for (let i = 0; i < extraColumnHeaders.length; i++) {
                const centerX = extraX + extraColWidths[i] / 2;
                // All headers, including Screen Info, use the same blue color
                doc.setTextColor(30, 64, 175); // blue
                doc.text(extraColumnHeaders[i], centerX, extraTableY + 8, { align: 'center' });
                extraX += extraColWidths[i];
              }
              doc.setTextColor(0, 0, 0);

              // Horizontal line after headers
              doc.line(extraTableX, extraTableY + 12, extraTableX + extraTableWidth, extraTableY + 12);

              // Draw row separators for extra rows
              for (let s = 1; s < extraSpareRows.length; s++) {
                const y = extraTableY + 12 + s * extraRowHeight;
                doc.line(extraTableX, y, extraTableX + extraTableWidth, y);
              }

              // Fill in extra spare rows, continuing item numbering
              const startingItemNumber = 2 + firstTableSpareRows.length;
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');

              for (let index = 0; index < extraSpareRows.length; index++) {
                const spare = extraSpareRows[index];
                const rowTop = extraTableY + 12 + index * extraRowHeight;
                const rowCenterY = rowTop + extraRowHeight / 2 + 2;

                let colX = extraTableX;

                // Item number
                const itemCenterX = colX + extraColWidths[0] / 2;
                doc.text(String(startingItemNumber + index), itemCenterX, rowCenterY, { align: 'center' });
                colX += extraColWidths[0];

                // Merged description across columns 1-3
                const mergedWidth = extraColWidths[1] + extraColWidths[2] + extraColWidths[3];
                const mergedTextX = colX + 2;
                doc.text(sanitizePdfText(spare.label), mergedTextX, rowCenterY, { align: 'left' });
                colX += mergedWidth;

                // Quantity + Area merged visually
                // Quantity shown from spare.qty, Area shown as 'Unit' for specific items.
                const mergedQtyWidth = extraColWidths[4] + extraColWidths[5];
                const qtyAreaCenterX = colX + mergedQtyWidth / 2;
                const label = spare.label || '';
                const isUnitAreaItem =
                  label.startsWith('Spare modules (3% of total modules)') ||
                  label.startsWith('Spare PSU') ||
                  label.startsWith('Spare receiving card') ||
                  label.startsWith('Package') ||
                  label.startsWith('Controller 1') ||
                  label.startsWith('Controller 2');

                // Render as "<qty> / Unit" for unit-based items, otherwise just qty.
                const qtyAreaText = isUnitAreaItem
                  ? `${sanitizePdfText(spare.qty)} / Unit`
                  : sanitizePdfText(spare.qty);

                doc.text(qtyAreaText, qtyAreaCenterX, rowCenterY, { align: 'center' });
                colX += mergedQtyWidth;

                // Total Price column
                // For specific spare items, always show "Included".
                // Otherwise, if a numeric price exists, show the calculated total.
                {
                  const priceCenterX = colX + extraColWidths[6] / 2;
                  const label = spare.label || '';
                  const isIncludedItem =
                    label.startsWith('Spare modules (3% of total modules)') ||
                    label.startsWith('Spare PSU') ||
                    label.startsWith('Spare receiving card') ||
                    label.startsWith('Package');

                  if (isIncludedItem) {
                    doc.text('Included', priceCenterX, rowCenterY, { align: 'center' });
                  } else if (spare.price !== undefined) {
                    const rawQty = spare.qty != null ? String(spare.qty) : '';
                    const qtyNumber = parseFloat(rawQty.split(' ')[0]);
                    const unitPrice = spare.price;
                    const totalPrice = !isNaN(qtyNumber) ? unitPrice * qtyNumber : unitPrice;
                    const priceText = totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    doc.text(priceText, priceCenterX, rowCenterY, { align: 'center' });
                  }
                }
              }

              currentY = extraTableY + extraTotalHeight + 15;
            }
          }
        }

        // Add total at the end with highlighted styling
        const finalY = currentY;
        const formattedTotal = pdfTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const currencyDisplay = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.symbol;

        const totalLabel = 'Total Amount:';
        const totalText = `${currencyDisplay} ${formattedTotal}`;
        const totalY = finalY + 20;

        // Measure width to size the highlight box
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const labelWidth = doc.getTextWidth(totalLabel + ' ' + totalText);
        const paddingX = 6;
        const paddingY = 4;
        const boxX = rightX - labelWidth - paddingX * 2;
        const boxY = totalY - 10;

        // Yellow highlight box
        doc.setFillColor(255, 223, 0); // bright yellow
        doc.setDrawColor(204, 158, 0); // darker yellow border
        doc.rect(boxX, boxY, labelWidth + paddingX * 2, 18 + paddingY, 'FD');

        // Total text in dark color on top
        doc.setTextColor(30, 64, 175); // dark blue text
        doc.text(`${totalLabel} ${totalText}`, rightX, totalY, { align: 'right' });

        // Restore text and draw colors
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);

        // Skip the autoTable section and go directly to terms
        const termsStartY = finalY + 50;
        addTermsAndConditions(doc, termsStartY, pageWidth, rightX);

      } else {
        // ORIGINAL FORMAT FOR LED LIGHTS (and mixed carts)
        const getSpecText = (item: any): string => {
          const specs: string[] = [];
          const pushSpec = (label: string, value: any) => {
            const val = Array.isArray(value) ? value.join(', ') : value;
            if (val && val !== '-' && val !== '') {
              specs.push(`${label}: ${val}`);
            }
          };

          pushSpec('Category', item.category);
          pushSpec('Wattage', item.watt ? item.watt + (String(item.watt).toUpperCase().includes('W') ? '' : 'W') : null);
          pushSpec('Dimension', item.dimension);
          pushSpec('Beam Angle', item.beamAngle);
          pushSpec('Lumen', item.lumen);
          pushSpec('IP Rating', item.ipRating);
          pushSpec('CCT', item.cct);
          pushSpec('Dimming', item.dimming);
          pushSpec('Accessories', item.accessories);
          pushSpec('Finish', item.finish);
          pushSpec('Reflector Finish', item.reflectorFinish);

          return specs.join('\n');
        };

        const rows = organizedCart.map((item, index) => {
          if (item.isDriver) {
            // Driver row - all specs in one large merged cell
            // Build complete driver specification string
            const driverSpecs = [];
            if (item.wattageRange) {
              // Just show the min value as the single wattage
              driverSpecs.push(`Power: ${item.wattageRange.min}W`);
            }
            if (item.outputVoltage) {
              driverSpecs.push(`Output: ${item.outputVoltage}`);
            }
            if (item.outputCurrent) {
              driverSpecs.push(`Current: ${item.outputCurrent}`);
            }

            if (item.ipRating) {
              driverSpecs.push(`IP: ${item.ipRating}`);
            }
            if (item.type) {
              driverSpecs.push(`Type: ${item.type}`);
            }
            const allSpecs = driverSpecs.join(' | ');

            const driverLabel = item.name
              ? `${item.name}${item.wattage && item.wattage !== 'N/A' ? ' - ' + item.wattage + (String(item.wattage).toUpperCase().includes('W') ? '' : 'W') : ''}`
              : item.sku ?? 'Driver';

            // Different format for lighting control drivers vs LED light drivers
            if (hasOnlyLightingControls) {
              return [
                index + 1, // SI No
                '', // No image for driver
                `${driverLabel}`, // No indentation or icon
                { content: allSpecs, colSpan: 1, styles: { halign: 'left' as const } }, // Description
                convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                item.quantity ?? 1,
                (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              ];
            } else {
              return [
                index + 1, // SI No
                '', // Code (blank for driver)
                `${driverLabel}`, // No indentation or icon
                { content: allSpecs, colSpan: 3, styles: { halign: 'left' as const } }, // Merged cell with all specs
                item.quantity ?? 1,
                convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              ];
            }
          } else if ((item as any).isLightingControl && hasOnlyLightingControls) {
            // Lighting Control row - Product Name and Description format
            const asAny = item as any;

            // Use the description field from the admin panel
            const description = asAny.description || '-';

            return [
              index + 1, // SI No
              '', // Image
              asAny.productName || item.sku || 'N/A', // Product Name
              description, // Description from admin panel
              convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              item.quantity ?? 1,
              (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
          } else {
            // LED Product row - normal format
            return [
              index + 1,
              productCodes[item.cartItemId] || '',  // Code column
              getSpecText(item),                     // Description
              item.sku ?? 'N/A',                    // Model No.
              '',                                    // Image
              'Nos',                                 // Unit
              item.quantity ?? 1,                    // Quantity
              convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
          }
        });

        const cellPadding = { top: 4, right: 3, bottom: 4, left: 3 } as const;
        autoTable(doc, {
          head: [columns],
          body: rows,
          startY: tableStartY,
          styles: {
            fontSize: 8,
            cellPadding,
            fontStyle: 'normal',
            valign: 'middle',
            halign: 'center',
            lineColor: [0, 0, 0], // Black border lines
            lineWidth: 1, // Bold border line thickness
            textColor: [0, 0, 0], // Black text for better visibility
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: [183, 183, 183],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 8,
            lineColor: [0, 0, 0],
            lineWidth: 1
          },
          margin: { left: 14, right: 14, top: 20 },
          columnStyles: hasOnlyLightingControls ? {
            0: { cellWidth: 15 },
            1: { cellWidth: 50 },
            2: { cellWidth: 'auto', minCellWidth: 70 },
            3: { cellWidth: 'auto', minCellWidth: 50 }
          } : {
            0: { cellWidth: 54, halign: 'center' },   // S.No.
            1: { cellWidth: 80, halign: 'center' },   // Code
            2: {
              cellWidth: 180,
              halign: 'left',
              overflow: 'linebreak',
              cellPadding: { top: 4, right: 4, bottom: 4, left: 4 }
            },    // Description
            3: { cellWidth: 80, halign: 'center' },   // Model No.
            4: { cellWidth: 80, halign: 'center' },   // Image
            5: { cellWidth: 80, halign: 'center' },   // Unit
            6: { cellWidth: 80, halign: 'center' },   // Quantity
            7: { cellWidth: 80, halign: 'center' },   // Unit Price
            8: { cellWidth: 100, halign: 'center' },   // Total Amount
          },
          theme: 'grid', // Use grid theme to show all borders
          didParseCell: (data: CellHookData) => {
            if (data.section === 'body') {
              data.cell.styles.overflow = 'linebreak';
              const idx = data.row.index;
              const item = organizedCart[idx];

              if (data.column.index === 2 && !item?.isDriver) {
                data.cell.styles.fontStyle = 'normal';
                data.cell.styles.overflow = 'linebreak';
                data.cell.styles.cellWidth = 180;
              }

              // For driver rows, use lighter background and smaller height
              if (item?.isDriver) {
                data.cell.styles.fillColor = [250, 250, 250]; // Very light gray
                data.cell.styles.textColor = [0, 0, 0]; // Black text for better visibility
                data.cell.styles.fontSize = 7.5;
                data.cell.styles.minCellHeight = 20; // Smaller height for drivers

                // Only make the Driver Label bold, keep everything else normal
                const driverLabelColIndex = hasOnlyLightingControls ? 2 : 2;
                if (data.column.index === driverLabelColIndex) {
                  data.cell.styles.fontStyle = 'bold';
                } else {
                  data.cell.styles.fontStyle = 'normal';
                }
              } else {
                const lineCount = getSpecText(organizedCart[idx]).split('\n').length;
                const dynamicHeight = Math.max(52, lineCount * 12);
                data.cell.styles.minCellHeight = dynamicHeight;
              }
            }
          },
          didDrawCell: (data: CellHookData) => {
            if (data.section === 'body') {
              const idx = data.row.index;
              const item = organizedCart[idx];
              if (!item) return;

              if (data.column.index === 2 && !item?.isDriver) {
                const specLines = getSpecText(item).split('\n');

                // Clear the auto-rendered text by drawing white rect
                (doc as any).setFillColor(255, 255, 255);
                doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');

                let textY = data.cell.y + 8;
                const textX = data.cell.x + 3;

                specLines.forEach((line) => {
                  const colonIndex = line.indexOf(':');
                  if (colonIndex !== -1) {
                    const label = line.substring(0, colonIndex + 1) + ' ';
                    const value = line.substring(colonIndex + 1).trim();
                    // Draw bold label
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    doc.text(label, textX, textY);
                    const labelWidth = doc.getTextWidth(label);

                    // Draw normal value
                    doc.setFont('helvetica', 'normal');
                    const maxWidth = data.cell.width - labelWidth - 6;
                    const splitValue = doc.splitTextToSize(value, maxWidth > 0 ? maxWidth : 10);
                    doc.text(splitValue, textX + labelWidth, textY);
                    textY += 12 * Math.max(1, splitValue.length); // Adjust Y for next line
                  } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    const maxWidth = data.cell.width - 6;
                    const splitLine = doc.splitTextToSize(line, maxWidth > 0 ? maxWidth : 10);
                    doc.text(splitLine, textX, textY);
                    textY += 12 * Math.max(1, splitLine.length); // Adjust Y for next line
                  }
                });
              }

              const imgColIndex = hasOnlyLightingControls ? 1 : 4;

              // Render images for product rows
              if (data.column.index === imgColIndex) {
                // Skip image rendering for driver rows
                if (item?.isDriver) {
                  return;
                }

                // For LED products, render image as normal
                const dataUrl = imageDataUrls[idx];
                const innerW = data.cell.width - (cellPadding.left + cellPadding.right);
                const innerH = (data.cell.height || 0) - (cellPadding.top + cellPadding.bottom);
                const imgW = Math.max(1, Math.min(targetImgWidth, innerW));
                const rawH = Math.max(46, (rowHeights[idx] || 46));
                const imgH = Math.min(rawH, innerH);
                const x = data.cell.x + cellPadding.left + (innerW - imgW) / 2;
                const y = data.cell.y + cellPadding.top + (innerH - imgH) / 2;
                if (dataUrl) {
                  try { doc.addImage(dataUrl, 'JPEG', x, y, imgW, imgH); } catch { }
                } else {
                  try {
                    (doc as any).setFillColor(240);
                    doc.rect(x, y, imgW, imgH, 'F');
                    (doc as any).setTextColor(120);
                    doc.setFontSize(6);
                    const label = 'No Image';
                    const tw = doc.getTextWidth(label);
                    const tx = x + (imgW - tw) / 2;
                    const ty = y + imgH / 2 + 2;
                    doc.text(label, tx, ty);
                  } catch { }
                }
              }
            }
          },
        });

        const finalY = (doc as any).lastAutoTable.finalY || 140;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        // Total is computed using overrides/area logic and conversion
        const formattedTotal = pdfTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const currencyDisplay = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.symbol;
        const totalBoxHeight = 20;
        const totalBoxWidth = pageWidth - 28;
        const totalBoxX = 14;
        const totalBoxY = finalY;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1);
        doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `Total Amount: ${currencyDisplay} ${formattedTotal}`,
          totalBoxX + totalBoxWidth - 5,
          totalBoxY + 13,
          { align: 'right' }
        );

        // Add terms and conditions
        const termsStartY = totalBoxY + totalBoxHeight;
        addTermsAndConditions(doc, termsStartY, pageWidth, rightX);
      }

      // Helper function to add terms and conditions
      function addTermsAndConditions(doc: any, startY: number, pageWidth: number, rightX: number) {
        // Add Terms and Conditions in a bordered box
        const pageHeight = doc.internal.pageSize.height;
        let termsY = startY;

        // Check if we need a new page for terms
        if (termsY > pageHeight - 200) {
          doc.addPage();
          termsY = 40;
        }

        // Calculate box dimensions
        const termsBoxX = 14;
        const termsBoxY = termsY;
        const termsBoxWidth = pageWidth - 28; // Full width with margins
        let termsContentY = termsBoxY + 15;

        // Add Terms header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Terms and Conditions:', termsBoxX + 8, termsContentY);

        termsContentY += 15;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

        let terms: string[];
        if (termsAndConditions.termsType === 'displays') {
          // Use free-form LED Display terms, one line per point
          terms = (termsAndConditions.displayTerms || '')
            .split('\n')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        } else if (termsAndConditions.termsType === 'lightingControls') {
          // Use free-form Lighting Controls terms, one line per point
          terms = (termsAndConditions.lightingControlsTerms || '')
            .split('\n')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        } else {
          // Default: LED Lights terms using structured fields
          terms = [
            `1. The prices quoted on ${termsAndConditions.deliveryLocation}.`,
            `2. Delivery: Within ${termsAndConditions.deliveryTime} from the date of PO and advance payment.`,
            `3. Payment Terms: ${termsAndConditions.paymentTerms}.`,
            `4. The quoted products are ${termsAndConditions.productMake}`,
            `5. Validity of offer: ${termsAndConditions.validityDays}`,
            `6. ${termsAndConditions.vatNote}`,
          ];
        }

        terms.forEach((term) => {
          const lines = doc.splitTextToSize(term, termsBoxWidth - 20);
          // Draw the term text
          doc.text(lines, termsBoxX + 8, termsContentY);
          // Draw a horizontal divider under this term
          const termBlockHeight = lines.length * 12;
          const lineY = termsContentY + termBlockHeight - 8; // a bit above the next term start
          doc.setDrawColor(200, 200, 200);
          doc.line(termsBoxX + 6, lineY, termsBoxX + termsBoxWidth - 6, lineY);
          doc.setDrawColor(0, 0, 0);
          termsContentY += termBlockHeight;
        });

        // Closing removed as per new LED Lights design

        // Draw box around entire terms section
        const termsBoxHeight = termsContentY - termsBoxY + 15;
        doc.setLineWidth(1);
        doc.setDrawColor(0, 0, 0); // Blue border
        doc.rect(termsBoxX, termsBoxY, termsBoxWidth, termsBoxHeight);
      }

      if (returnBlob) {
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        clearInterval(progressInterval);
        setDownloadProgress(100);
        setDownloadSuccess('pdf');
        setTimeout(() => {
          setDownloadSuccess(null);
          setDownloadProgress(0);
          setDownloadingType(null);
        }, 3000);
        return url;
      }

      doc.save(`${userInfo.project}_quotation.pdf`);
      clearInterval(progressInterval);
      setDownloadProgress(100);
      setDownloadSuccess('pdf');
      setTimeout(() => {
        setDownloadSuccess(null);
        setDownloadProgress(0);
        setDownloadingType(null);
      }, 3000);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const generatePdfBlob = async (): Promise<string | null> => {
    try {
      const url = await exportPDF(true);
      return url || null;
    } catch {
      return null;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`max-w-md w-full mx-4 rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white'
            }`}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Login Required
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    You need to be logged in to download quotations. Please login or register to continue.
                  </p>
                </div>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                    }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-3 mt-6">
                <Link
                  href="/login"
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-center transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold text-center transition-colors ${isDarkMode
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                    }`}
                >
                  Register
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${isDarkMode ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
            }`}>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
              File downloaded successfully!
            </span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/products"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md ${isDarkMode
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm'
                  }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Products</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
            <CurrencySelector />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  My Quotations
                  {cart.length > 0 && (
                    <span className="ml-2 bg-yellow-400 text-black px-2 py-0.5 rounded-full text-xs font-bold">
                      {totalItems}
                    </span>
                  )}
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Review and generate quotations
                </p>
              </div>
            </div>
          </div>
        </div>

        {cart.length === 0 ? (
          /* Empty Cart State */
          <div className={`rounded-2xl p-12 sm:p-16 text-center ${isDarkMode ? 'bg-gray-900/50 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'
            }`}>
            <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-6">
              <Package className={`w-16 h-16 sm:w-20 sm:h-20 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              No Products Added Yet
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Start by browsing our products and adding items to create your quotation
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <ShoppingCart className="w-5 h-5" />
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Cart Items - Left Column */}
            <div className="lg:col-span-3">
              {/* Products Count Header */}
              <div className={`mb-4 px-5 py-3 rounded-xl flex items-center justify-between ${isDarkMode ? 'bg-gray-900/30 border border-white/5' : 'bg-gray-50 border border-gray-200'
                }`}>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {cart.length} Product{cart.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    if (confirm('Remove all products?')) {
                      clearCart();
                    }
                  }}
                  className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm hover:shadow-md ${isDarkMode
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                    }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const organizedCartRender: any[] = [];
                  cart.forEach(item => {
                    if (!item.isDriver) {
                      organizedCartRender.push(item);
                    }
                  });
                  const standaloneDriversRender = cart.filter(item => item.isDriver && !item.parentProductId);
                  organizedCartRender.push(...standaloneDriversRender);

                  return organizedCartRender.map((item) => {
                    const isDisplay = isDisplayItem(item);
                    return (
                      <div
                        key={item.cartItemId}
                        className={`${isDisplay ? 'col-span-2' : ''}`}
                      >
                        <div
                          className={`rounded-none p-4 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg ${isDarkMode ? '' : ''
                            }`}
                        >
                          {isDisplay ? (
                            <div className="flex flex-col md:flex-row gap-4">
                              {/* Left: Image */}
                              <div className="flex-shrink-0 md:self-stretch">
                                <div className="w-full max-w-sm md:max-w-md min-h-[12rem] md:min-h-[14rem] h-full rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col overflow-hidden mx-auto md:mx-0">
                                  {(() => {
                                    const image1 = item.productImages?.[0] || item.images?.[0];
                                    const image2 = item.productImages?.[1] || item.images?.[1];

                                    if (!image1 && !image2) {
                                      return (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Package className="w-10 h-10 text-slate-400" />
                                        </div>
                                      );
                                    }

                                    // Both images: stack with subtle divider, each taking half height
                                    if (image1 && image2) {
                                      return (
                                        <>
                                          <div className="h-1/2 border-b border-slate-200 bg-white/60">
                                            <img
                                              src={image1}
                                              alt={item.sku}
                                              className="w-full h-full object-contain p-3"
                                            />
                                          </div>
                                          <div className="h-1/2 bg-white/60">
                                            <img
                                              src={image2}
                                              alt={item.sku}
                                              className="w-full h-full object-contain p-3"
                                            />
                                          </div>
                                        </>
                                      );
                                    }

                                    // Single image only
                                    const single = image1 || image2;
                                    return (
                                      <div className="w-full h-full relative bg-white/60">
                                        <img
                                          src={single}
                                          alt={item.sku}
                                          className="w-full h-full object-contain p-3"
                                        />
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Center: Product Info & Specs */}
                              <div className="flex-1 flex flex-col gap-3 mt-3 md:mt-0">
                                {/* Header Section */}
                                <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-2">
                                  <div>
                                    <h3 className="font-semibold text-base text-gray-900 tracking-tight">
                                      {item.sku}
                                    </h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      {item.category && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-white">
                                          {item.category}
                                        </span>
                                      )}
                                      {item.pixelPitch && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                                          {item.pixelPitch}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Specifications Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                                  {item.application && (
                                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                          Application
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900">{item.application}</p>
                                      </div>
                                    </div>
                                  )}
                                  {item.ipRating && item.ipRating !== 'N/A' && (
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                          IP Rating
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900">
                                          {typeof item.ipRating === 'string'
                                            ? item.ipRating
                                            : Array.isArray(item.ipRating)
                                              ? (item.ipRating as string[]).join(', ')
                                              : String(item.ipRating)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {(item.suggestedSize || item.requiredLength || item.requiredWidth) && (
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                          Suggested Size
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900">
                                          {item.suggestedSize && item.suggestedSize.trim() !== ''
                                            ? item.suggestedSize
                                            : (item.requiredLength || item.requiredWidth)
                                              ? `W${(() => {
                                                const ft = parseFloat(item.requiredLength || '0');
                                                return (ft * 0.3048).toFixed(2);
                                              })()}m × H${(() => {
                                                const ft = parseFloat(item.requiredWidth || '0');
                                                return (ft * 0.3048).toFixed(2);
                                              })()}m`
                                              : 'N/A'}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {item.totalResolution && item.totalResolution.trim() !== '' && (
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5">
                                      <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                          Screen Resolution
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900">{item.totalResolution}</p>
                                      </div>
                                    </div>
                                  )}
                                  {typeof item.cabinetRequired === 'number' && item.cabinetRequired > 0 && (
                                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 col-span-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                      <div className="flex-1">
                                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                          Cabinet Arrangement
                                        </p>
                                        {(() => {
                                          const w = (item as any).cabinetArrangementWidth as number | undefined;
                                          const h = (item as any).cabinetArrangementHeight as number | undefined;
                                          const total = item.cabinetRequired;
                                          if (w && h) {
                                            return (
                                              <div className="flex flex-col text-xs text-gray-900 font-semibold">
                                                <span>{`W${w} × H${h}`}</span>
                                                <span className="text-[10px] text-gray-500 font-normal">({total} cabinets)</span>
                                              </div>
                                            );
                                          }
                                          return (
                                            <p className="text-xs font-semibold text-gray-900">{total} cabinets</p>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Controllers Row */}
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {/* Controller 1 */}
                                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                      Controller 1
                                    </p>
                                    <div className="space-y-1.5">
                                      <div>
                                        <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Name</span>
                                        <input
                                          type="text"
                                          value={item.controller1Name ?? ''}
                                          onChange={(e) =>
                                            updateCartItem(item.cartItemId, { controller1Name: e.target.value })
                                          }
                                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          placeholder="Enter controller name"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Price ({currencyInfo.code})</span>
                                          <div className="relative">
                                            <span className="absolute left-2 top-1.5 text-gray-500 text-xs">{currencyInfo.symbol}</span>
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              value={item.controller1Price !== undefined && item.controller1Price !== null ? Number(convertPrice(item.controller1Price).toFixed(2)) : ''}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                const rate = convertPrice(1) || 1;
                                                const basePrice = val / rate;
                                                updateCartItem(item.cartItemId, {
                                                  controller1Price: isNaN(val) || val < 0 ? undefined : basePrice,
                                                });
                                              }}
                                              className="w-full rounded-md border border-gray-300 pl-6 pr-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              placeholder="0.00"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Quantity</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={item.controller1Qty ?? ''}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value, 10);
                                              updateCartItem(item.cartItemId, {
                                                controller1Qty: isNaN(val) || val < 0 ? undefined : val,
                                              });
                                            }}
                                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="0"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Controller 2 */}
                                  <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-3">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                      Controller 2
                                    </p>
                                    <div className="space-y-1.5">
                                      <div>
                                        <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Name</span>
                                        <input
                                          type="text"
                                          value={item.controller2Name ?? ''}
                                          onChange={(e) =>
                                            updateCartItem(item.cartItemId, { controller2Name: e.target.value })
                                          }
                                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          placeholder="Enter controller name"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Price ({currencyInfo.code})</span>
                                          <div className="relative">
                                            <span className="absolute left-2 top-1.5 text-gray-500 text-xs">{currencyInfo.symbol}</span>
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              value={item.controller2Price !== undefined && item.controller2Price !== null ? Number(convertPrice(item.controller2Price).toFixed(2)) : ''}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                const rate = convertPrice(1) || 1;
                                                const basePrice = val / rate;
                                                updateCartItem(item.cartItemId, {
                                                  controller2Price: isNaN(val) || val < 0 ? undefined : basePrice,
                                                });
                                              }}
                                              className="w-full rounded-md border border-gray-300 pl-6 pr-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              placeholder="0.00"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Quantity</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={item.controller2Qty ?? ''}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value, 10);
                                              updateCartItem(item.cartItemId, {
                                                controller2Qty: isNaN(val) || val < 0 ? undefined : val,
                                              });
                                            }}
                                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="0"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Quantity & Total Row */}
                                <div className="mt-3 flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-gray-600">Quantity:</span>
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-2 shadow-sm">
                                      <button
                                        onClick={() => decreaseQuantity(item.cartItemId)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-700 transition-all hover:bg-white hover:text-blue-600 hover:shadow-md"
                                      >
                                        <Minus className="h-3.5 w-3.5" />
                                      </button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 1;
                                          updateQuantity(item.cartItemId, value);
                                        }}
                                        onFocus={() => setEditingQuantity(item.cartItemId)}
                                        onBlur={() => setEditingQuantity(null)}
                                        className="w-12 bg-transparent text-center text-sm font-bold text-gray-900 outline-none"
                                      />
                                      <button
                                        onClick={() => increaseQuantity(item.cartItemId)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-700 transition-all hover:bg-white hover:text-blue-600 hover:shadow-md"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="mb-0.5 text-[10px] font-medium text-gray-500">Total Display Price ({currencyInfo.code})</p>
                                    <p className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-base font-bold text-transparent">
                                      {(() => {
                                        const totalConverted = computeItemTotal(item);
                                        const formatted = totalConverted.toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        });
                                        return `${currencyInfo.symbol} ${formatted}`;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              <div className="flex flex-col items-end justify-between gap-3">
                                <button
                                  onClick={() => removeFromCart(item.cartItemId)}
                                  className="rounded-full border border-red-200 bg-red-50 p-2.5 text-red-600 shadow-sm transition-all hover:border-red-300 hover:bg-red-100 hover:text-red-700 hover:shadow-md"
                                  title="Remove from cart"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    setEditingDisplay(item);
                                    // Base form data
                                    let baseData: any = {
                                      __context: 'cart',
                                      ...item,
                                      moduleSpecs: item.moduleSpecs || {},
                                      cabinetSpecs: item.cabinetSpecs || {},
                                      screenParams: item.screenParams || {},
                                      customTotalManuallyEdited: false,
                                      priceInput: (typeof item.price === 'number' ? String(item.price) : (item.price || '')) as any,
                                      cabinetRequiredManuallyEdited: false,
                                    };
                                    // Try to hydrate cabinet specs from backend by SKU
                                    try {
                                      if (item.sku) {
                                        const res = await fetch(`/api/led-displays?search=${encodeURIComponent(item.sku)}`);
                                        if (res.ok) {
                                          const list = await res.json();
                                          const match = Array.isArray(list) ? list.find((d: any) => d.sku === item.sku) : null;
                                          if (match) {
                                            // Merge cabinet specs
                                            if (match.cabinetSpecs) {
                                              const mergedCabinetSpecs = { ...match.cabinetSpecs, ...baseData.cabinetSpecs };
                                              baseData.cabinetSpecs = mergedCabinetSpecs;
                                            }

                                            // Limit Cabinet Material Variants to the user-selected one (if any)
                                            if (Array.isArray(match.cabinetMaterialVariants) && match.cabinetMaterialVariants.length > 0) {
                                              const selectedMaterial = (item as any).selectedCabinetMaterial as string | undefined;
                                              let variants = match.cabinetMaterialVariants as any[];
                                              if (selectedMaterial) {
                                                const filtered = variants.filter(v => v.material === selectedMaterial);
                                                if (filtered.length > 0) {
                                                  variants = filtered;
                                                }
                                              }
                                              baseData.cabinetMaterialVariants = variants;
                                            }
                                            // If required size present, compute initial cabinetRequired
                                            const FEET_TO_METER = 0.3048;
                                            const lenFt = parseFloat((baseData as any)?.requiredLength ?? '');
                                            const widFt = parseFloat((baseData as any)?.requiredWidth ?? '');
                                            if (!isNaN(lenFt) && !isNaN(widFt) && lenFt > 0 && widFt > 0) {
                                              const lenM = lenFt * FEET_TO_METER;
                                              const widM = widFt * FEET_TO_METER;
                                              const areaSqm = lenM * widM;
                                              // Use baseData.cabinetSpecs (which already contains mergedCabinetSpecs)
                                              let cabArea = (baseData as any)?.cabinetSpecs?.cabinetArea as number | undefined;
                                              if (!(typeof cabArea === 'number' && cabArea > 0)) {
                                                const sizeStr = (baseData as any)?.cabinetSpecs?.cabinetSize || '';
                                                const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                                if (m) {
                                                  const w = parseFloat(m[1]);
                                                  const h = parseFloat(m[2]);
                                                  if (!isNaN(w) && !isNaN(h)) {
                                                    cabArea = (w / 1000) * (h / 1000);
                                                  }
                                                }
                                              }
                                              if (cabArea && cabArea > 0) {
                                                baseData.cabinetRequired = Math.round(areaSqm / cabArea);
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } catch { }
                                    setDisplayFormData(baseData);
                                    // Reset price edit lock state when opening editor
                                    setPriceEditUnlocked(false);
                                    setShowPriceEditModal(false);
                                    setPriceEditPassword('');
                                    setPriceEditError('');
                                  }}
                                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all border-2 border-blue-400 hover:border-blue-500"
                                >
                                  Edit Specs
                                </button>
                              </div>
                            </div>
                          ) : (
                            item.isDriver ? (
                              <div className="flex flex-col gap-2 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 px-3 py-2.5 shadow-sm mt-2 max-w-lg mx-auto md:mx-0 md:ml-4">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-700 text-slate-100 border border-slate-600">
                                        🔌 Driver
                                      </span>
                                      {item.series && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-800 text-slate-100 border border-slate-600">
                                          {item.series}
                                        </span>
                                      )}
                                      {item.type && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">
                                          {item.type}
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="font-bold text-xs mb-0.5 truncate text-white">
                                      {item.name || item.sku}{item.wattage && item.wattage !== 'N/A' ? ` - ${item.wattage}${String(item.wattage).toUpperCase().includes('W') ? '' : 'W'}` : ''}
                                    </h3>
                                    {item.category && (
                                      <p className="text-[10px] text-slate-300">
                                        {item.category}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeFromCart(item.cartItemId)}
                                    className="p-1.5 rounded-lg transition-all flex-shrink-0 hover:bg-red-500/10 text-red-300 hover:text-red-200"
                                    title="Remove Driver"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {item.outputVoltage && (
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-emerald-200 border border-slate-700">
                                      OV: {item.outputVoltage}
                                    </span>
                                  )}
                                  {item.outputCurrent && (
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-sky-200 border border-slate-700">
                                      OC: {item.outputCurrent}
                                    </span>
                                  )}
                                  {item.wattageRange && (
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-violet-200 border border-slate-700">
                                      {item.wattageRange.min}-{item.wattageRange.max}W
                                    </span>
                                  )}
                                  {item.ipRating && item.ipRating !== 'N/A' && (
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-teal-200 border border-slate-700">
                                      {item.ipRating}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 border border-slate-600">
                                    <button
                                      onClick={() => decreaseQuantity(item.cartItemId)}
                                      className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-slate-800 hover:shadow text-slate-100"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        updateQuantity(item.cartItemId, value);
                                      }}
                                      onFocus={() => setEditingQuantity(item.cartItemId)}
                                      onBlur={() => setEditingQuantity(null)}
                                      className="w-10 text-center font-bold text-xs outline-none bg-transparent text-yellow-300"
                                    />
                                    <button
                                      onClick={() => increaseQuantity(item.cartItemId)}
                                      className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-slate-800 hover:shadow text-slate-100"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-slate-300">
                                      {formatPrice(item.price ?? 0)} × {item.quantity}
                                    </p>
                                    <p className="text-sm font-bold text-slate-100">
                                      {formatPrice((item.price ?? 0) * (item.quantity ?? 1))}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-row gap-4 items-stretch">
                                <div className="flex-shrink-0 w-40 h-40 md:w-48 md:h-48 rounded-none overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm">
                                  {(item.productImages?.length || item.images?.length) ? (
                                    <img
                                      src={item.productImages?.[0] || item.images?.[0]}
                                      alt={item.sku}
                                      className="w-full h-full object-contain p-2"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-8 h-8 text-slate-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                  <div>
                                    <div className="flex justify-between items-start gap-1 mb-1.5">
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-xs mb-0.5 truncate text-gray-900">
                                          {item.sku}
                                        </h3>
                                        {item.productName && (
                                          <p className="text-[10px] text-gray-700 mb-0.5 leading-snug">
                                            {item.productName}
                                          </p>
                                        )}
                                        <p className="text-[10px] text-gray-600">
                                          {item.category}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-black text-xs font-bold">
                                            Code:
                                          </span>
                                          <input
                                            type="text"
                                            value={productCodes[item.cartItemId] || ''}
                                            onChange={(e) => setProductCodes(prev => ({
                                              ...prev,
                                              [item.cartItemId]: e.target.value
                                            }))}
                                            placeholder="e.g. L1, CL2"
                                            className="bg-white border border-gray-300 text-gray-900 font-bold text-xs rounded px-2 py-1 w-28 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-400 shadow-sm"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCartItem(item);
                                            setEditSpecs({
                                              category: item.category || '',
                                              watt: item.watt || '',
                                              lumen: item.lumen || '',
                                              dimension: item.dimension || '',
                                              beamAngle: item.beamAngle || '',
                                              ipRating: Array.isArray(item.ipRating)
                                                ? item.ipRating.join(', ')
                                                : item.ipRating || '',
                                              cct: (item as any).cct || '',
                                              price: item.price || '',
                                              dimming: (item as any).dimming || '',
                                              accessories: (item as any).accessories || '',
                                              finish: (item as any).finish || '',
                                              reflectorFinish: (item as any).reflectorFinish || '',
                                              quantity: item.quantity || 1,
                                            });
                                          }}
                                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[10px] font-bold mr-2 shadow-sm"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => removeFromCart(item.cartItemId)}
                                          className="p-1.5 rounded-lg transition-all flex-shrink-0 hover:bg-red-50 text-red-600 hover:text-red-700"
                                          title="Remove"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {(item as any).selectedVariant?.channels && (
                                        <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-gradient-to-r from-indigo-500 to-blue-500 text-white border border-indigo-600 shadow-sm">
                                          {(item as any).selectedVariant.channels} Channel{(item as any).selectedVariant.channels > 1 ? 's' : ''}
                                        </span>
                                      )}
                                      {(item as any).selectedVariant?.size && (
                                        <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-gradient-to-r from-slate-600 to-slate-700 text-white border border-slate-700 shadow-sm">
                                          {(item as any).selectedVariant.size}
                                        </span>
                                      )}
                                      {item.watt && item.watt !== '-' && (
                                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                          {item.watt}{String(item.watt).toUpperCase().includes('W') ? '' : 'W'}
                                        </span>
                                      )}
                                      {item.lumen && item.lumen !== '-' && (
                                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                          {item.lumen.toLowerCase().includes('lm') ? item.lumen : `${item.lumen}lm`}
                                        </span>
                                      )}
                                      {item.beamAngle && item.beamAngle !== '-' && (
                                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                          {item.beamAngle}
                                        </span>
                                      )}
                                      {item.ipRating && item.ipRating !== 'N/A' && (
                                        <span className="inline-block bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-yellow-200">
                                          {item.ipRating}
                                        </span>
                                      )}
                                      {(item as any).cct && (item as any).cct !== '-' && (item as any).cct !== 'None' && (
                                        <span className="inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-200">
                                          {(item as any).cct}
                                        </span>
                                      )}
                                      {(item as any).dimming && (item as any).dimming !== '-' && (item as any).dimming !== 'None' && (
                                        <span className="inline-block bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-200">
                                          {(item as any).dimming}
                                        </span>
                                      )}
                                      {(item as any).accessories && (item as any).accessories !== '-' && (item as any).accessories !== 'None' && (
                                        <span className="inline-block bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-rose-200">
                                          {(item as any).accessories}
                                        </span>
                                      )}
                                      {(item as any).finish && (item as any).finish !== '-' && (item as any).finish !== 'None' && (
                                        <span className="inline-block bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200">
                                          Finish: {(item as any).finish}
                                        </span>
                                      )}
                                      {(item as any).reflectorFinish && (item as any).reflectorFinish !== '-' && (item as any).reflectorFinish !== 'None' && (
                                        <span className="inline-block bg-zinc-50 text-zinc-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-zinc-200">
                                          Reflector: {(item as any).reflectorFinish}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 shadow-sm">
                                        <button
                                          onClick={() => decreaseQuantity(item.cartItemId)}
                                          className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-white hover:shadow text-gray-900"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <input
                                          type="number"
                                          min="1"
                                          value={item.quantity}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 1;
                                            updateQuantity(item.cartItemId, value);
                                          }}
                                          onFocus={() => setEditingQuantity(item.cartItemId)}
                                          onBlur={() => setEditingQuantity(null)}
                                          className="w-10 text-center font-bold text-xs outline-none bg-transparent text-gray-900"
                                        />
                                        <button
                                          onClick={() => increaseQuantity(item.cartItemId)}
                                          className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-white hover:shadow text-gray-900"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="text-right min-w-0 flex-1">
                                        <p className="text-[10px] text-gray-500 break-words">
                                          {currencyInfo.symbol}{formatINR(convertPrice(item.price ?? 0))} × {item.quantity}
                                        </p>
                                        <p className="text-sm font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent break-words">
                                          {currencyInfo.symbol}{formatINR(convertPrice((item.price ?? 0) * (item.quantity ?? 1)))}
                                        </p>
                                      </div>
                                    </div>
                                    {!item.isDriver && !isDisplay && !(item as any).isLightingControl && (
                                      <button
                                        onClick={() => fetchDriversForProduct(item)}
                                        className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 border border-blue-200 transition-all text-xs font-bold shadow-sm hover:shadow"
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                        Add Driver
                                      </button>
                                    )}
                                    {!item.isDriver && !isDisplay && !(item as any).isLightingControl && getDriversForProduct(item.cartItemId).length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        <p className="text-[10px] font-bold text-gray-700 mb-1.5">Drivers:</p>
                                        {getDriversForProduct(item.cartItemId).map((driver) => (
                                          <div key={driver.cartItemId} className="flex flex-col gap-1.5 mb-1.5 p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 shadow-sm">
                                            <div className="flex items-start justify-between gap-1">
                                              <div className="flex-1 min-w-0 pr-2">
                                                <p className="text-[10px] font-bold text-blue-900 mb-1" title={driver.name}>
                                                  {driver.name}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-1 text-[9px] text-blue-800 font-medium">
                                                  {driver.wattage && driver.wattage !== 'N/A' && (
                                                    <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                      {driver.wattage}{String(driver.wattage).toUpperCase().includes('W') ? '' : 'W'}
                                                    </span>
                                                  )}
                                                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                    Qty: {driver.quantity}
                                                  </span>
                                                  <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200/60 break-words max-w-full inline-block">
                                                    {currencyInfo.symbol}{formatINR(convertPrice(driver.price ?? 0))}/unit
                                                  </span>
                                                  {driver.outputVoltage && (
                                                    <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                      OV: {driver.outputVoltage}
                                                    </span>
                                                  )}
                                                  {driver.outputCurrent && (
                                                    <span className="bg-white/60 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                      OC: {driver.outputCurrent}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingDriver(driver);
                                                    setEditDriverName(driver.name || '');
                                                    setEditDriverWattage(String(driver.wattage || ''));
                                                    setEditDriverPrice(String(driver.price || ''));
                                                    setEditDriverQuantity(driver.quantity || 1);
                                                  }}
                                                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[10px] font-bold shadow-sm"
                                                >
                                                  Edit
                                                </button>
                                                <button
                                                  onClick={() => removeFromCart(driver.cartItemId)}
                                                  className="p-1 rounded-md hover:bg-red-200/50 text-red-600 transition-all flex-shrink-0"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                            <div className="flex items-start justify-between mt-1 pt-1 border-t border-blue-200/50 gap-2">
                                              <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-md p-0.5 shrink-0">
                                                <button onClick={() => decreaseQuantity(driver.cartItemId)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"><Minus className="w-3 h-3" /></button>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={driver.quantity || 1}
                                                  onChange={(e) => {
                                                    const value = parseInt(e.target.value) || 1;
                                                    updateQuantity(driver.cartItemId, value);
                                                  }}
                                                  className="w-8 text-center font-bold text-xs outline-none bg-transparent text-gray-900"
                                                />
                                                <button onClick={() => increaseQuantity(driver.cartItemId)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"><Plus className="w-3 h-3" /></button>
                                              </div>
                                              <div className="text-right flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-blue-900 break-words">Total: {currencyInfo.symbol}{formatINR(convertPrice((driver.price ?? 0) * (driver.quantity ?? 1)))}</p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Clear Cart Button - Mobile */}
              <button
                onClick={() => {
                  if (confirm('Remove all products?')) {
                    clearCart();
                  }
                }}
                className={`w-full sm:hidden mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${isDarkMode
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>

            {/* Summary - Right Column */}
            <div className="lg:col-span-1">
              <div className={`rounded-2xl p-6 sticky top-6 ${isDarkMode ? 'bg-gray-900/50 border border-white/10 shadow-xl' : 'bg-white border border-gray-200 shadow-xl'
                }`}>
                <div className="flex items-center justify-between mb-6 gap-3">
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Summary
                  </h2>
                  <button
                    onClick={() => {
                      const next = !isDarkMode;
                      setIsDarkMode(next);
                      if (typeof window !== 'undefined') {
                        try {
                          window.localStorage.setItem('qlite-theme', next ? 'dark' : 'light');
                        } catch {
                          // Ignore localStorage errors
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${isDarkMode
                      ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                      : 'bg-gray-800 hover:bg-gray-900 text-white border border-gray-700'
                      }`}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {isDarkMode ? (
                      <>
                        <Sun className="w-3.5 h-3.5" />
                        <span>Light</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Contact Details */}
                <div className="mb-6">
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    Client's Detail
                  </h3>

                  <div className="space-y-3.5">
                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <Mail className="w-3.5 h-3.5" />
                        Email
                        <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={userInfo.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${isDarkMode
                          ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <Phone className="w-3.5 h-3.5" />
                        Mobile
                        <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <input
                        type="tel"
                        name="mobile"
                        value={userInfo.mobile}
                        onChange={handleChange}
                        placeholder="+1234567890"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${isDarkMode
                          ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                        Attn (Name)
                        <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        name="project"
                        value={userInfo.project}
                        onChange={handleChange}
                        placeholder="Contact person name"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${isDarkMode
                          ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                        Company
                        <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={userInfo.company}
                        onChange={handleChange}
                        placeholder="Company name"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${isDarkMode
                          ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <FileText className="w-3.5 h-3.5" />
                        Subject
                      </label>
                      <input
                        type="text"
                        name="subject"
                        value={userInfo.subject}
                        onChange={handleChange}
                        placeholder="e.g., Quotation"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${isDarkMode
                          ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>



                    {/* Address Selector */}
                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <Package className="w-3.5 h-3.5" />
                        Select Address
                      </label>
                      <select
                        value={selectedAddress}
                        onChange={(e) => setSelectedAddress(e.target.value as 'bahrain' | 'uae' | 'bangalore' | 'delhi')}
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none cursor-pointer ${isDarkMode
                          ? 'bg-black border border-white/20 text-white focus:border-yellow-400'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400'
                          }`}
                      >
                        <option value="bahrain">Bahrain</option>
                        <option value="uae">UAE (Dubai)</option>
                        <option value="bangalore">India - Bangalore</option>
                        <option value="delhi">India - Delhi</option>
                      </select>
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        <FileText className="w-3.5 h-3.5" />
                        Project Code
                        <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        name="invoiceNo"
                        value={userInfo.invoiceNo}
                        onChange={handleChange}
                        placeholder="e.g., QT-12345678"
                        className={`w-full px-3 py-2.5 rounded-lg text-xs transition-all outline-none ${(!userInfo.invoiceNo || userInfo.invoiceNo.trim() === '') && showError
                          ? 'border-red-500 bg-red-50'
                          : isDarkMode
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                          }`}
                      />
                    </div>

                  </div>
                </div>

                {/* Final Total */}
                <div className={`p-4 rounded-xl mb-6 ${isDarkMode ? 'bg-gradient-to-br from-yellow-400/10 to-orange-400/10 border border-yellow-400/30 shadow-lg' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-300 shadow-md'
                  }`}>
                  <div className="flex justify-between items-start gap-4">
                    <span className={`text-sm font-bold whitespace-nowrap shrink-0 mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Final Total
                    </span>
                    <span className="text-amber-600 font-bold text-lg leading-tight break-words text-right flex-1 min-w-0">
                      {currencyInfo.symbol}{formatINR(total)}
                    </span>
                  </div>
                </div>

                {/* Discount Slider */}
                <div className="mb-6">
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    💎 Apply Discount
                  </h3>
                  <div className={`p-4 rounded-xl border ${isDarkMode
                    ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-400/40 shadow-xl shadow-yellow-400/10'
                    : 'bg-gradient-to-br from-white to-yellow-50/30 border-yellow-400/50 shadow-xl'
                    }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Discount Rate
                      </span>
                      <div className={`px-4 py-1.5 rounded-lg font-bold text-lg transition-all ${isDarkMode
                        ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/50 shadow-lg shadow-yellow-400/20'
                        : 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white border border-yellow-500 shadow-lg'
                        }`}>
                        {discount}%
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full h-2.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-yellow-500 transition-all"
                    />
                    <div className="flex justify-between mt-2 mb-4">
                      <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>0%</span>
                      <span className={`text-xs font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-orange-600'}`}>15% Max</span>
                    </div>

                    {discount > 0 && (
                      <div className={`p-3 rounded-lg mb-3 border-l-4 transition-all ${isDarkMode
                        ? 'bg-green-500/10 border-green-400 shadow-md shadow-green-400/10'
                        : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500 shadow-md'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                            ✨ Total Savings
                          </span>
                          <span className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            -{currencyInfo.symbol} {discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowContactPopup(true)}
                      className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all border-2 ${isDarkMode
                        ? 'bg-white text-black border-white hover:bg-gray-100 hover:shadow-lg'
                        : 'bg-black text-white border-black hover:bg-gray-800 hover:shadow-xl'
                        }`}
                    >
                      Request Custom Quotation
                    </button>
                  </div>

                  {showError && (
                    <div className={`mt-3 p-2 rounded-md flex items-start gap-2 ${isDarkMode
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                      : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px]">Fill all fields to download</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowTermsModal(true)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-white border border-white/20'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                      }`}
                  >
                    <Settings className="w-4 h-4" />
                    Edit Terms & Conditions
                  </button>

                  {downloadingType && (
                    <div className="flex items-center gap-2 p-3 mb-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-medium animate-pulse">
                      ⏳ Preparing your quotation, please wait...
                    </div>
                  )}
                  {downloadSuccess && (
                    <div className="flex items-center gap-2 p-3 mb-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
                      ✅ {downloadSuccess === 'excel' ? 'Excel' : 'PDF'} downloaded successfully!
                    </div>
                  )}


                  <div className="grid grid-cols-2 gap-2">
                    {/* PDF Button */}
                    <button
                      onClick={() => {
                        if (!canDownload) {
                          setShowMissingDetailsPopup(true);
                        } else {
                          setShowDownloadConfirm('pdf');
                        }
                      }}
                      disabled={downloadingType !== null}
                      className={`relative flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-sm transition-all cursor-pointer overflow-hidden ${downloadingType !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {/* Progress bar fill */}
                      {downloadingType === 'pdf' && (
                        <div
                          className="absolute left-0 top-0 h-full bg-blue-400 transition-all duration-200"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        {downloadingType === 'pdf' ? (
                          <>⏳ Generating... {downloadProgress}%</>
                        ) : downloadingType !== null ? (
                          <>🔒 PDF</>
                        ) : (
                          <>Download PDF</>
                        )}
                      </span>
                    </button>

                    {/* Excel Button */}
                    <button
                      onClick={() => {
                        if (!canDownload) {
                          setShowMissingDetailsPopup(true);
                        } else {
                          setShowDownloadConfirm('excel');
                        }
                      }}
                      disabled={downloadingType !== null}
                      className={`relative flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-sm transition-all cursor-pointer overflow-hidden ${downloadingType !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {/* Progress bar fill */}
                      {downloadingType === 'excel' && (
                        <div
                          className="absolute left-0 top-0 h-full bg-green-400 transition-all duration-200"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        {downloadingType === 'excel' ? (
                          <>⏳ Generating... {downloadProgress}%</>
                        ) : downloadingType !== null ? (
                          <>🔒 Excel</>
                        ) : (
                          <>Download Excel</>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact Popup Modal */}
      {showContactPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full rounded-xl ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
            }`}>
            {/* Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'
              }`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Contact Sales Team
                  </h3>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Get in touch for bulk pricing and custom requirements
                  </p>
                </div>
                <button
                  onClick={() => setShowContactPopup(false)}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">

              <div className="space-y-6">
                {/* Middle East Section */}
                <div>
                  <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <MapPin className="w-4 h-4 text-yellow-400" />
                    Middle East
                  </h4>
                  <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <a href="mailto:jignesh@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          jignesh@qliteglobal.com
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <a href="mailto:amit@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          amit@qliteglobal.com
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <a href="mailto:kunal@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          kunal@qliteglobal.com
                        </a>
                      </div>

                    </div>
                  </div>
                </div>

                {/* India Section */}
                <div>
                  <h4 className={`font-bold text-sm mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <MapPin className="w-4 h-4 text-yellow-400" />
                    India
                  </h4>
                  <div className="space-y-3">
                    {/* Bangalore */}
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}>
                      <div className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Bangalore
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <a href="mailto:revant@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          revant@qliteglobal.com
                        </a>
                      </div>
                    </div>

                    {/* Delhi */}
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}>
                      <div className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Delhi
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <a href="mailto:revant@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          ankit.mittal@qliteglobal.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mt-4 p-3 rounded-lg text-center ${isDarkMode ? 'bg-gray-800/50 border border-white/10' : 'bg-gray-50 border border-gray-200'
                }`}>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Our sales team typically responds within the business hours
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Edit Unlock Modal */}
      {showPriceEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className={`w-full max-w-sm rounded-xl overflow-hidden ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
            }`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'}`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <Lock className="w-4 h-4 text-blue-500" /> Enter Password to Edit Price
              </h3>
            </div>
            <div className="p-4">
              <label className={`text-xs font-semibold block mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
              <input
                type="password"
                value={priceEditPassword}
                onChange={(e) => { setPriceEditPassword(e.target.value); setPriceEditError(''); }}
                className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${isDarkMode ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500' : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                placeholder="Enter password"
              />
              {priceEditError && (
                <p className={`mt-2 text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{priceEditError}</p>
              )}
            </div>
            <div className={`flex justify-end gap-2 p-4 border-t ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-100 bg-gray-50'}`}>
              <button
                type="button"
                onClick={() => { setShowPriceEditModal(false); setPriceEditPassword(''); setPriceEditError(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDarkMode ? 'bg-transparent border border-white/20 text-gray-200 hover:bg-white/10' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (priceEditPassword === PRICE_EDIT_PASSWORD) {
                    setPriceEditUnlocked(true);
                    setShowPriceEditModal(false);
                    setPriceEditPassword('');
                    setPriceEditError('');
                  } else {
                    setPriceEditError('Invalid password');
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Selection Modal */}
      {/* LED Display Edit Modal */}
      {editingDisplay && displayFormData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl ${isDarkMode ? 'bg-gray-900 border-2 border-white/10' : 'bg-white border-2 border-gray-200'
            }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-5 border-b-2 flex-shrink-0 ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-gray-100'
              }`}>
              <div>
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Edit LED Display Specifications
                </h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-black'}`}>
                  SKU: {editingDisplay.sku}
                </p>
              </div>
              <button
                onClick={handleCloseDisplayEdit}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-600 text-white'
                  }`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form Content */}
            <div className={`px-6 py-5 overflow-y-auto flex-1 min-h-0 ${isDarkMode ? 'bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900' : 'bg-white'
              }`}>
              {renderLedDisplayFormFields(displayFormData, setDisplayFormData, isDarkMode)}

              {/* Spare and Accessories */}
              <div className={`mt-6 p-5 rounded-xl border-2 shadow-lg ${isDarkMode ? 'bg-gray-900/40 border-white/10' : 'bg-white border-gray-200'
                }`}>
                <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <span className="w-1.5 h-7 bg-indigo-600 rounded shadow-sm"></span>
                  Spare and Accessories
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Spare modules - Quantity only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="font-bold mb-4 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>Spare modules (3% of total modules)</span>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Quantity</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const current = Number(displayFormData?.spareModulesQty ?? 0) || 0;
                            const next = Math.max(0, current - 1);
                            setDisplayFormData({ ...displayFormData, spareModulesQty: next });
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={displayFormData?.spareModulesQty ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setDisplayFormData({ ...displayFormData, spareModulesQty: isNaN(val) || val < 0 ? 0 : val });
                          }}
                          className={`flex-1 text-center py-2 rounded-lg border-2 text-sm font-semibold ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = Number(displayFormData?.spareModulesQty ?? 0) || 0;
                            const next = current + 1;
                            setDisplayFormData({ ...displayFormData, spareModulesQty: next });
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Spare PSU - With name and quantity */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>Spare PSU</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                        <input
                          type="text"
                          value={displayFormData?.sparePSUName ?? ''}
                          onChange={(e) => setDisplayFormData({ ...displayFormData, sparePSUName: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'}`}
                          placeholder="e.g., Spare PSU"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Quantity</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const current = Number(displayFormData?.sparePSUQty ?? 0) || 0;
                              const next = Math.max(0, current - 1);
                              setDisplayFormData({ ...displayFormData, sparePSUQty: next });
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={displayFormData?.sparePSUQty ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDisplayFormData({ ...displayFormData, sparePSUQty: isNaN(val) || val < 0 ? 0 : val });
                            }}
                            className={`flex-1 text-center py-2 rounded-lg border-2 text-sm font-semibold ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = Number(displayFormData?.sparePSUQty ?? 0) || 0;
                              const next = current + 1;
                              setDisplayFormData({ ...displayFormData, sparePSUQty: next });
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Power 3-phase Cable - Info only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>Main Power 3-phase Cable</span>
                    </div>
                    <p className={isDarkMode ? 'text-xs text-gray-300' : 'text-xs text-gray-700'}>
                      Connect to the nearby power distribution room (as per site requirement).
                    </p>
                  </div>

                  {/* Fibre Cable from Control Room - Info only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-gray-50'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>Fibre Cable from Control Room</span>
                    </div>
                    <p className={isDarkMode ? 'text-xs text-gray-300' : 'text-xs text-gray-700'}>
                      As per site requirement.
                    </p>
                  </div>

                  {/* Power Distributor Box / Signal Fibre Cable - Info only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>Power Distributor Box / Signal Fibre Cable</span>
                    </div>
                    <p className={isDarkMode ? 'text-xs text-gray-300' : 'text-xs text-gray-200'}>
                      As per site requirement.
                    </p>
                  </div>

                  {/* Equipment Rack for Controller - Info only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>Equipment Rack for Controller</span>
                    </div>
                    <p className={isDarkMode ? 'text-xs text-gray-300' : 'text-xs text-gray-200'}>
                      As per site requirement.
                    </p>
                  </div>

                  {/* CMS with License Duration */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>CMS (Content Management System)</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>Include CMS?</label>
                        <select
                          value={displayFormData?.cmsInclude ?? 'No'}
                          onChange={(e) => {
                            const include = e.target.value;
                            setDisplayFormData({
                              ...displayFormData,
                              cmsInclude: include,
                              cmsLicenseYears: include === 'Yes' ? (displayFormData?.cmsLicenseYears || 3) : undefined,
                            });
                          }}
                          className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-slate-800 border-slate-400 text-white'
                            }`}
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>
                      {displayFormData?.cmsInclude === 'Yes' && (
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>License Duration</label>
                          <select
                            value={displayFormData?.cmsLicenseYears ?? 3}
                            onChange={(e) => setDisplayFormData({ ...displayFormData, cmsLicenseYears: parseInt(e.target.value, 10) })}
                            className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-slate-800 border-slate-400 text-white'
                              }`}
                          >
                            <option value={1}>1 Year ($125)</option>
                            <option value={3}>3 Years ($375)</option>
                            <option value={5}>5 Years ($625)</option>
                            <option value={7}>7 Years ($875)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MS Structure Fabrication and Installation at Site - sqm auto-populated */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>MS Structure Fabrication and Installation at Site</span>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>
                        Area (sqm) - Auto from Price Calculation
                      </label>
                      <div className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-semibold ${isDarkMode ? 'bg-gray-800/50 border-white/10 text-gray-300' : 'bg-slate-800/50 border-slate-400 text-gray-300'
                        }`}>
                        {(() => {
                          const widM = parseFloat(displayFormData?.requiredLength ?? '0');
                          const heiM = parseFloat(displayFormData?.requiredWidth ?? '0');
                          const hasWid = !isNaN(widM) && widM > 0;
                          const hasHei = !isNaN(heiM) && heiM > 0;
                          const areaSqm = hasWid && hasHei ? widM * heiM : 0;
                          return areaSqm > 0 ? areaSqm.toFixed(2) : 'N/A';
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Spare receiving card - Quantity only */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-4 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>Spare receiving card</span>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>Quantity</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const current = Number(displayFormData?.spareReceivingCardQty ?? 0) || 0;
                            const next = Math.max(0, current - 1);
                            setDisplayFormData({ ...displayFormData, spareReceivingCardQty: next });
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={displayFormData?.spareReceivingCardQty ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setDisplayFormData({ ...displayFormData, spareReceivingCardQty: isNaN(val) || val < 0 ? 0 : val });
                          }}
                          className={`flex-1 text-center py-2 rounded-lg border-2 text-sm font-semibold ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-slate-800 border-slate-400 text-white'}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const current = Number(displayFormData?.spareReceivingCardQty ?? 0) || 0;
                            const next = current + 1;
                            setDisplayFormData({ ...displayFormData, spareReceivingCardQty: next });
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Package - With name and quantity */}
                  <div className={`${isDarkMode ? 'bg-gray-900/60' : 'bg-slate-900/70'} rounded-lg p-3 border ${isDarkMode ? 'border-white/10' : 'border-slate-500'}`}>
                    <div className="font-bold mb-2 flex justify-between items-center">
                      <span className={isDarkMode ? 'text-gray-200' : 'text-gray-100'}>Package</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>Name</label>
                        <input
                          type="text"
                          value={displayFormData?.packageName ?? ''}
                          onChange={(e) => setDisplayFormData({ ...displayFormData, packageName: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-medium ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-slate-800 border-slate-400 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'}`}
                          placeholder="e.g., Flight case"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-200'}`}>Quantity</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const current = Number(displayFormData?.packageQty ?? 0) || 0;
                              const next = Math.max(0, current - 1);
                              setDisplayFormData({ ...displayFormData, packageQty: next });
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={displayFormData?.packageQty ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDisplayFormData({ ...displayFormData, packageQty: isNaN(val) || val < 0 ? 0 : val });
                            }}
                            className={`flex-1 text-center py-2 rounded-lg border-2 text-sm font-semibold ${isDarkMode ? 'bg-gray-800 border-white/20 text-white' : 'bg-slate-800 border-slate-400 text-white'}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = Number(displayFormData?.packageQty ?? 0) || 0;
                              const next = current + 1;
                              setDisplayFormData({ ...displayFormData, packageQty: next });
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg font-bold ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-slate-400 text-white hover:bg-slate-700'}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Price Calculation Preview - EDITABLE */}
              <div className={`mt-6 p-5 rounded-xl border-2 shadow-lg ${isDarkMode ? 'bg-gray-900/30 border-white/10' : 'bg-white border-gray-200'
                }`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    <span className="w-1.5 h-7 bg-emerald-600 rounded shadow-sm"></span>
                    <Settings className="w-5 h-5" />
                    Price Calculation Preview (Editable)
                    {!priceEditUnlocked && (
                      <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold ${isDarkMode ? 'bg-white/10 text-gray-200' : 'bg-yellow-500 text-slate-900 border-2 border-yellow-400 shadow-sm'}`}>🔒 Locked</span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (!priceEditUnlocked) {
                        setPriceEditPassword('');
                        setPriceEditError('');
                        setShowPriceEditModal(true);
                      } else {
                        setPriceEditUnlocked(false);
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-gray-100 border border-gray-300 text-gray-800'
                      }`}
                  >
                    {priceEditUnlocked ? (<><Unlock className="w-3 h-3" /> Unlocked</>) : (<><Lock className="w-3 h-3" /> Unlock to edit</>)}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {(() => {
                    const METER_TO_FEET = 1 / 0.3048;
                    // Now requiredLength and requiredWidth are stored in METERS
                    const widM = parseFloat(displayFormData?.requiredLength ?? '0');
                    const heiM = parseFloat(displayFormData?.requiredWidth ?? '0');
                    const hasWid = !isNaN(widM) && widM > 0;
                    const hasHei = !isNaN(heiM) && heiM > 0;

                    // Area (sqm) in the price panel should match the suggested-size / cabinet-arrangement logic
                    // used for the PDF and Area(sqm) display.
                    let areaSqm = 0;
                    const cabSizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                    const match = String(cabSizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                    if (hasWid && hasHei && match) {
                      const cabWidMm = parseFloat(match[1]);
                      const cabHeiMm = parseFloat(match[2]);
                      if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                        const cabWidM = cabWidMm / 1000;
                        const cabHeiM = cabHeiMm / 1000;
                        const cabsWid = widM / cabWidM;
                        const cabsHei = heiM / cabHeiM;

                        const customRound = (v: number) => {
                          const dec = v - Math.floor(v);
                          return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                        };

                        const roundedW = customRound(cabsWid);
                        const roundedH = customRound(cabsHei);

                        const sugWid = roundedW * cabWidM;
                        const sugHei = roundedH * cabHeiM;
                        areaSqm = sugWid * sugHei;
                      }
                    }

                    // Fallback: width×height if we can't derive area from cabinet size
                    if (areaSqm <= 0 && hasWid && hasHei) {
                      areaSqm = widM * heiM;
                    }

                    const pricePerSqm = displayFormData.price ?? 0;
                    const unitPriceUSD = areaSqm * pricePerSqm;
                    const unitPriceConverted = convertPrice(unitPriceUSD);
                    const qty = editingDisplay?.quantity ?? 1;
                    const totalConverted = unitPriceConverted * qty;
                    const currencyDisplay = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.code;

                    return (
                      <>
                        {/* Request Width (m) - EDITABLE */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <label className="font-semibold block mb-1">Request Width (m):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={displayFormData?.requiredLength ?? ''}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Update width (stored in requiredLength for backward compatibility)
                              let next: any = { ...displayFormData, requiredLength: val };
                              // Recompute area-based total if possible and not manually overridden
                              const widM = parseFloat(val);
                              const heiM = parseFloat(displayFormData?.requiredWidth ?? '0');
                              const hasWid = !isNaN(widM) && widM > 0;
                              const hasHei = !isNaN(heiM) && heiM > 0;
                              if (hasWid && hasHei) {
                                const areaSqm = widM * heiM;
                                // Auto-calc cabinet arrangement using cabinet size from DB (in mm)
                                const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                                const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                if (m && !displayFormData?.cabinetRequiredManuallyEdited) {
                                  const cabWidMm = parseFloat(m[1]);
                                  const cabHeiMm = parseFloat(m[2]);
                                  if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                                    const cabWidM = cabWidMm / 1000;
                                    const cabHeiM = cabHeiMm / 1000;
                                    const cabsWid = widM / cabWidM;
                                    const cabsHei = heiM / cabHeiM;
                                    // Custom rounding: ≤0.5 rounds down, >0.5 rounds up
                                    const customRound = (v: number) => {
                                      const dec = v - Math.floor(v);
                                      return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                                    };
                                    const roundedW = customRound(cabsWid);
                                    const roundedH = customRound(cabsHei);
                                    next.cabinetRequired = roundedW * roundedH;
                                    next.cabinetArrangementWidth = roundedW;
                                    next.cabinetArrangementHeight = roundedH;
                                  }
                                }
                                if (!displayFormData?.customTotalManuallyEdited) {
                                  const unitUSD = areaSqm * (displayFormData?.price || 0);
                                  const unitConv = convertPrice(unitUSD);
                                  const qty = editingDisplay?.quantity ?? 1;
                                  const calc = unitConv * qty;
                                  next.customTotalConverted = Math.round(calc * 100) / 100;
                                }
                              }
                              setDisplayFormData(next);
                            }}
                            disabled={!priceEditUnlocked}
                            className={`w-full px-2 py-1.5 rounded border text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode
                              ? `bg-gray-800 border-white/20 text-white ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              : `bg-white border-gray-300 text-gray-900 ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              }`}
                            placeholder="Width in meters"
                          />
                        </div>

                        {/* Request Height (m) - EDITABLE */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <label className="font-semibold block mb-1">Request Height (m):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={displayFormData?.requiredWidth ?? ''}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => {
                              const val = e.target.value;
                              let next: any = { ...displayFormData, requiredWidth: val };
                              const widM = parseFloat(displayFormData?.requiredLength ?? '0');
                              const heiM = parseFloat(val);
                              const hasWid = !isNaN(widM) && widM > 0;
                              const hasHei = !isNaN(heiM) && heiM > 0;
                              if (hasWid && hasHei) {
                                const areaSqm = widM * heiM;
                                // Auto-calc cabinet arrangement
                                const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                                const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                if (m && !displayFormData?.cabinetRequiredManuallyEdited) {
                                  const cabWidMm = parseFloat(m[1]);
                                  const cabHeiMm = parseFloat(m[2]);
                                  if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                                    const cabWidM = cabWidMm / 1000;
                                    const cabHeiM = cabHeiMm / 1000;
                                    const cabsWid = widM / cabWidM;
                                    const cabsHei = heiM / cabHeiM;
                                    const customRound = (v: number) => {
                                      const dec = v - Math.floor(v);
                                      return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                                    };
                                    const roundedW = customRound(cabsWid);
                                    const roundedH = customRound(cabsHei);
                                    next.cabinetRequired = roundedW * roundedH;
                                    next.cabinetArrangementWidth = roundedW;
                                    next.cabinetArrangementHeight = roundedH;
                                  }
                                }
                                if (!displayFormData?.customTotalManuallyEdited) {
                                  const unitUSD = areaSqm * (displayFormData?.price || 0);
                                  const unitConv = convertPrice(unitUSD);
                                  const qty = editingDisplay?.quantity ?? 1;
                                  const calc = unitConv * qty;
                                  next.customTotalConverted = Math.round(calc * 100) / 100;
                                }
                              }
                              setDisplayFormData(next);
                            }}
                            disabled={!priceEditUnlocked}
                            className={`w-full px-2 py-1.5 rounded border text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode
                              ? `bg-gray-800 border-white/20 text-white ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              : `bg-white border-gray-300 text-gray-900 ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              }`}
                            placeholder="Height in meters"
                          />
                        </div>

                        {/* Request Size (Ft) - Display Only - Converted from meters */}
                        <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} col-span-2`}>
                          <label className="font-semibold block mb-1">Request Size (Ft):</label>
                          <div className={`w-full px-3 py-2 rounded border text-sm ${isDarkMode ? 'bg-gray-800/50 border-white/20' : 'bg-white/90 border-gray-300 text-gray-900'
                            }`}>
                            {hasWid && hasHei
                              ? `W${(widM * METER_TO_FEET).toFixed(2)}ft × H${(heiM * METER_TO_FEET).toFixed(2)}ft`
                              : 'Enter width and height above'
                            }
                          </div>
                        </div>

                        {/* Request Size (m) - READ ONLY - Original meter input */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold">Request Size (m):</span>
                          <div className="mt-1">{hasWid && hasHei ? `W${widM.toFixed(2)}m × H${heiM.toFixed(2)}m` : 'N/A'}</div>
                        </div>

                        {/* Suggested Size (m) - AUTO from cabinet arrangement (recomputed) and cabinet size, editable when unlocked */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold block mb-1">Suggested Size (m):</span>
                          {(() => {
                            const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                            const match = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);

                            let autoValue: string | null = null;
                            if (hasWid && hasHei && match) {
                              const cabWidMm = parseFloat(match[1]);
                              const cabHeiMm = parseFloat(match[2]);
                              if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                                const cabWidM = cabWidMm / 1000;
                                const cabHeiM = cabHeiMm / 1000;
                                const cabsWid = widM / cabWidM;
                                const cabsHei = heiM / cabHeiM;

                                const customRound = (v: number) => {
                                  const dec = v - Math.floor(v);
                                  return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                                };

                                const roundedW = customRound(cabsWid);
                                const roundedH = customRound(cabsHei);

                                const sugWid = roundedW * cabWidM;
                                const sugHei = roundedH * cabHeiM;
                                autoValue = `W${sugWid.toFixed(2)}m × H${sugHei.toFixed(2)}m`;
                              }
                            }

                            const effectiveValue = (displayFormData as any)?.suggestedSize || autoValue || 'N/A';

                            if (!priceEditUnlocked) {
                              return <div className="mt-1">{effectiveValue}</div>;
                            }

                            return (
                              <input
                                type="text"
                                value={(displayFormData as any)?.suggestedSize ?? autoValue ?? ''}
                                onChange={(e) => setDisplayFormData({ ...displayFormData, suggestedSize: e.target.value })}
                                className={`mt-1 w-full px-2 py-1.5 rounded border text-xs ${isDarkMode
                                  ? 'bg-gray-800 border-white/20 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                placeholder={autoValue || 'Enter suggested size'}
                              />
                            );
                          })()}
                        </div>

                        {/* Screen Resolution - AUTO from cabinet arrangement and cabinet resolution, editable when unlocked */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold block mb-1">Screen Resolution:</span>
                          {(() => {
                            const resStr = (displayFormData as any)?.cabinetSpecs?.cabinetResolution || '';
                            const match = String(resStr).match(/(\d+)\s*[xX*×]\s*(\d+)/);

                            let autoValue: string | null = null;
                            if (hasWid && hasHei && match) {
                              const cabWidPx = parseInt(match[1], 10);
                              const cabHeiPx = parseInt(match[2], 10);
                              if (!isNaN(cabWidPx) && !isNaN(cabHeiPx) && cabWidPx > 0 && cabHeiPx > 0) {
                                // Reuse the same arrangement rounding logic as Suggested Size
                                const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                                const sizeMatch = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                if (sizeMatch) {
                                  const cabWidMm = parseFloat(sizeMatch[1]);
                                  const cabHeiMm = parseFloat(sizeMatch[2]);
                                  if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                                    const cabWidM = cabWidMm / 1000;
                                    const cabHeiM = cabHeiMm / 1000;
                                    const cabsWid = widM / cabWidM;
                                    const cabsHei = heiM / cabHeiM;

                                    const customRound = (v: number) => {
                                      const dec = v - Math.floor(v);
                                      return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                                    };

                                    const roundedW = customRound(cabsWid);
                                    const roundedH = customRound(cabsHei);

                                    const totalWidPx = roundedW * cabWidPx;
                                    const totalHeiPx = roundedH * cabHeiPx;
                                    autoValue = `W${totalWidPx.toLocaleString()} × H${totalHeiPx.toLocaleString()}`;
                                  }
                                }
                              }
                            }

                            const manualVal = (displayFormData as any)?.totalResolution as string | undefined;
                            const effectiveValue = manualVal || autoValue || 'N/A';

                            if (!priceEditUnlocked) {
                              return <div className="mt-1">{effectiveValue}</div>;
                            }

                            return (
                              <input
                                type="text"
                                value={manualVal ?? autoValue ?? ''}
                                onChange={(e) => setDisplayFormData({ ...displayFormData, totalResolution: e.target.value })}
                                className={`mt-1 w-full px-2 py-1.5 rounded border text-xs ${isDarkMode
                                  ? 'bg-gray-800 border-white/20 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                placeholder={autoValue || 'Enter screen resolution'}
                              />
                            );
                          })()}
                        </div>

                        {/* Area (sqm) - READ ONLY - Calculated from Suggested Size */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold">Area (sqm):</span>
                          <div className={`mt-1 font-bold ${isDarkMode ? 'text-gray-100' : 'text-slate-700'}`}>
                            {(() => {
                              // Calculate area from Suggested Size instead of Request Size
                              const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                              const match = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);

                              if (hasWid && hasHei && match) {
                                const cabWidMm = parseFloat(match[1]);
                                const cabHeiMm = parseFloat(match[2]);
                                if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                                  const cabWidM = cabWidMm / 1000;
                                  const cabHeiM = cabHeiMm / 1000;
                                  const cabsWid = widM / cabWidM;
                                  const cabsHei = heiM / cabHeiM;

                                  const customRound = (v: number) => {
                                    const dec = v - Math.floor(v);
                                    return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                                  };

                                  const roundedW = customRound(cabsWid);
                                  const roundedH = customRound(cabsHei);

                                  // Suggested Size dimensions
                                  const sugWid = roundedW * cabWidM;
                                  const sugHei = roundedH * cabHeiM;

                                  // Area = Suggested Size (W × H)
                                  const suggestedArea = sugWid * sugHei;
                                  return suggestedArea.toFixed(2) + ' m²';
                                }
                              }
                              return 'N/A';
                            })()}
                          </div>
                        </div>

                        {/* Price per sqm (USD) - EDITABLE */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <label className="font-semibold block mb-1">Price per sqm (USD):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={displayFormData?.priceInput ?? (displayFormData?.price != null ? String(displayFormData.price) : '')}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Update string value first to avoid flicker/leading zero
                              let next: any = { ...displayFormData, priceInput: val };
                              const parsed = parseFloat(val);
                              // Recompute total (converted) if numeric and not manually edited
                              // Now using meters directly
                              const widM = parseFloat(displayFormData?.requiredLength ?? '0');
                              const heiM = parseFloat(displayFormData?.requiredWidth ?? '0');
                              const hasWid = !isNaN(widM) && widM > 0;
                              const hasHei = !isNaN(heiM) && heiM > 0;
                              const areaSqm = hasWid && hasHei ? widM * heiM : 0;
                              if (!isNaN(parsed)) {
                                next.price = parsed;
                                const unitUSD = areaSqm * parsed;
                                const unitConv = convertPrice(unitUSD);
                                const qty = editingDisplay?.quantity ?? 1;
                                const newTotal = Math.round(unitConv * qty * 100) / 100;
                                if (!displayFormData?.customTotalManuallyEdited) {
                                  next.customTotalConverted = newTotal;
                                }
                              } else {
                                next.price = undefined;
                              }
                              setDisplayFormData(next);
                            }}
                            disabled={!priceEditUnlocked}
                            className={`w-full px-2 py-1.5 rounded border text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode
                              ? `bg-gray-800 border-white/20 text-white ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              : `bg-white border-gray-300 text-gray-900 ${!priceEditUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`
                              }`}
                            placeholder="Price per sqm"
                          />
                        </div>

                        {/* Cabinet Arrangement - Display W×H format (same logic as product page), editable when unlocked */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold block mb-1">Cabinet Arrangement:</span>
                          {(() => {
                            const sizeStr = (displayFormData as any)?.cabinetSpecs?.cabinetSize || '';
                            const match = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                            if (!hasWid || !hasHei || !match) {
                              return (
                                <span className="text-xs text-gray-500">Enter dimensions above</span>
                              );
                            }

                            const cabWidMm = parseFloat(match[1]);
                            const cabHeiMm = parseFloat(match[2]);
                            if (!isNaN(cabWidMm) && !isNaN(cabHeiMm) && cabWidMm > 0 && cabHeiMm > 0) {
                              const cabWidM = cabWidMm / 1000;
                              const cabHeiM = cabHeiMm / 1000;
                              const cabsWid = widM / cabWidM;
                              const cabsHei = heiM / cabHeiM;

                              const customRound = (v: number) => {
                                const dec = v - Math.floor(v);
                                return dec <= 0.5 ? Math.floor(v) : Math.ceil(v);
                              };

                              const autoW = customRound(cabsWid);
                              const autoH = customRound(cabsHei);

                              const manualW = (displayFormData as any)?.cabinetArrangementWidth as number | undefined;
                              const manualH = (displayFormData as any)?.cabinetArrangementHeight as number | undefined;
                              const effW = manualW && manualW > 0 ? manualW : autoW;
                              const effH = manualH && manualH > 0 ? manualH : autoH;
                              const total = effW * effH;

                              // Keep cabinetRequired in sync with effective arrangement
                              if (displayFormData.cabinetRequired !== total) {
                                setDisplayFormData({ ...displayFormData, cabinetRequired: total });
                              }

                              if (!priceEditUnlocked) {
                                return (
                                  <div className="mt-1 flex flex-col gap-1">
                                    <span className="font-bold text-yellow-400">
                                      {`W${effW} × H${effH}`}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      ({total} cabinets)
                                    </span>
                                  </div>
                                );
                              }

                              // Editable W/H when unlocked
                              return (
                                <div className="mt-1 flex flex-col gap-1">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-gray-500">Edit:</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={manualW ?? autoW}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        const nextW = isNaN(val) || val <= 0 ? autoW : val;
                                        const nextTotal = nextW * effH;
                                        setDisplayFormData({
                                          ...displayFormData,
                                          cabinetArrangementWidth: nextW,
                                          cabinetRequired: nextTotal,
                                        });
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className={`w-12 px-1 py-0.5 rounded border text-[10px] outline-none ${isDarkMode
                                        ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                        : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                        }`}
                                    />
                                    <span className="text-gray-500">×</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={manualH ?? autoH}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        const nextH = isNaN(val) || val <= 0 ? autoH : val;
                                        const nextTotal = effW * nextH;
                                        setDisplayFormData({
                                          ...displayFormData,
                                          cabinetArrangementHeight: nextH,
                                          cabinetRequired: nextTotal,
                                        });
                                      }}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className={`w-12 px-1 py-0.5 rounded border text-[10px] outline-none ${isDarkMode
                                        ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                        : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                        }`}
                                    />
                                  </div>
                                  <span className="font-bold text-yellow-400">
                                    {`W${effW} × H${effH}`}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    ({total} cabinets)
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <span className="text-xs text-gray-500">Enter dimensions above</span>
                            );
                          })()}
                        </div>

                        {/* Quantity - READ ONLY (editable elsewhere) */}
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          <span className="font-semibold">Quantity:</span>
                          <div className="mt-1">{qty}</div>
                        </div>

                        {/* Calculated Totals - Editable Total when unlocked (Unit Price hidden) */}
                        <div className={`col-span-2 pt-2 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                          {/* Unit Price hidden as requested */}
                          {priceEditUnlocked ? (
                            <div className="mt-2">
                              <label className={`text-xs font-semibold block mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Total ({currencyDisplay})</label>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{currencyInfo.symbol}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={(displayFormData?.customTotalConverted ?? Math.round(totalConverted * 100) / 100).toFixed(2)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onChange={(e) => setDisplayFormData({ ...displayFormData, customTotalConverted: parseFloat(e.target.value) || 0, customTotalManuallyEdited: true })}
                                  className={`flex-1 px-2 py-1.5 rounded border text-xs [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode
                                    ? 'bg-gray-800 border-white/20 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className={`font-bold mt-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                              Total ({currencyDisplay}): {currencyInfo.symbol}{(displayFormData?.customTotalConverted ?? totalConverted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <p className={`text-[10px] mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Formula: Area (sqm) = W(m) × H(m) | Total derives from area × price per sqm × qty (unit price hidden)
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className={`flex justify-end gap-3 px-6 py-5 border-t-2 flex-shrink-0 ${isDarkMode ? 'border-white/10 bg-gray-900/80' : 'border-slate-600 bg-white from-slate-800 to-slate-900'
              }`}>
              <button
                type="button"
                onClick={handleCloseDisplayEdit}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isDarkMode
                  ? 'bg-transparent border-2 border-white/20 text-gray-200 hover:bg-white/10'
                  : 'bg-white border-2 border-gray-400 text-gray-700 hover:bg-gray-50 shadow-sm'
                  }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDisplayEdit}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Edit Driver</h3>
              <button
                type="button"
                onClick={() => setEditingDriver(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Driver Name *
                </label>
                <input
                  type="text"
                  list="driver-options-edit"
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="driver-options-edit">
                  <option value="Meanwell/Fullham/BAG INDIA Driver" />
                  <option value="Non Dimmable Driver" />
                  <option value="Dimmable Driver" />
                  <option value="DALI Driver" />
                </datalist>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Wattage</label>
                <input
                  type="text"
                  value={editDriverWattage}
                  onChange={(e) => setEditDriverWattage(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Price (INR)
                </label>
                <input
                  type="text"
                  value={editDriverPrice}
                  onChange={(e) => setEditDriverPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <span className="text-gray-400 text-sm">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditDriverQuantity(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white cursor-pointer"
                  >−</button>
                  <span className="text-white font-bold w-8 text-center">
                    {editDriverQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditDriverQuantity(prev => prev + 1)}
                    className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white cursor-pointer"
                  >+</button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!editDriverName) return;
                  updateCartItem(editingDriver.cartItemId, {
                    ...editingDriver,
                    name: editDriverName,
                    wattage: editDriverWattage,
                    price: Number(editDriverPrice) || 0,
                    quantity: editDriverQuantity,
                  });
                  setEditingDriver(null);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
              >
                Update Driver
              </button>
            </div>
          </div>
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-xl overflow-hidden ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
            }`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
              }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Zap className="w-5 h-5 text-blue-500" />
                    Add Driver for {selectedProductForDriver?.sku}
                    {selectedProductForDriver?.watt && (
                      <span className="text-blue-500">
                        ({selectedProductForDriver.watt}W)
                      </span>
                    )}
                  </h3>
                </div>
                <button
                  onClick={handleCloseDriverModal}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 mb-3">
                  <label className={`block text-sm font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Driver Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="driver-options"
                    value={customDriverName}
                    onChange={(e) => setCustomDriverName(e.target.value)}
                    placeholder="Select or type driver name..."
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                  <datalist id="driver-options">
                    <option value="Meanwell/Fullham/BAG INDIA Driver" />
                    <option value="Non Dimmable Driver" />
                    <option value="Dimmable Driver" />
                    <option value="DALI Driver" />
                  </datalist>
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Wattage
                  </label>
                  <input
                    type="text"
                    value={customDriverWattage}
                    onChange={(e) => setCustomDriverWattage(e.target.value)}
                    placeholder="e.g. 60W"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Price (INR)
                  </label>
                  <input
                    type="number"
                    value={customDriverPrice}
                    onChange={(e) => setCustomDriverPrice(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCustomDriverQuantity(Math.max(1, customDriverQuantity - 1))}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        }`}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={customDriverQuantity}
                      onChange={(e) => setCustomDriverQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className={`text-base font-semibold w-16 text-center outline-none bg-transparent ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    />
                    <button
                      onClick={() => setCustomDriverQuantity(customDriverQuantity + 1)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        }`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddCustomDriver}
                  disabled={!customDriverName}
                  className={`w-full py-3 mt-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${!customDriverName
                    ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02]'
                    }`}
                >
                  <Plus size={18} />
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-3xl w-full rounded-xl max-h-[90vh] overflow-hidden ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
            }`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
              }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Settings className="w-5 h-5 text-blue-500" />
                    Edit Terms & Conditions
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Customize terms for your territory
                  </p>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                {/* Terms Type Selector */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Terms apply to
                  </label>
                  <select
                    value={termsAndConditions.termsType}
                    onChange={(e) =>
                      setTermsAndConditions((prev) => ({
                        ...prev,
                        termsType: e.target.value as 'lights' | 'displays' | 'lightingControls',
                      }))
                    }
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 focus:border-blue-500'
                      }`}
                  >
                    <option value="lights">LED Lights</option>
                    <option value="displays">LED Displays</option>
                    <option value="lightingControls">Lighting Controls</option>
                  </select>
                  <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    This choice controls which Terms & Conditions appear in the PDF quotation.
                  </p>
                </div>

                {/* LED Display Terms (hidden editor, kept for future use) */}

                {/* Live Preview of Terms that will appear in PDF */}
                <div
                  className={
                    isDarkMode
                      ? 'border border-blue-500/40 bg-blue-950/40 rounded-lg p-4'
                      : 'border border-blue-300 bg-blue-50 rounded-lg p-4'
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={
                        isDarkMode
                          ? 'text-xs font-semibold uppercase tracking-wide text-blue-300'
                          : 'text-xs font-semibold uppercase tracking-wide text-blue-700'
                      }
                    >
                      PDF Terms Preview ({termsAndConditions.termsType === 'displays' ? 'LED Displays' : termsAndConditions.termsType === 'lightingControls' ? 'Lighting Controls' : 'LED Lights'})
                    </span>
                  </div>
                  <div className={`text-xs space-y-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {termsAndConditions.termsType === 'displays' ? (
                      // Preview for LED Displays: each non-empty line from displayTerms
                      (termsAndConditions.displayTerms || '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0)
                        .map((line, idx) => (
                          <div key={idx} className="flex gap-1">
                            <span className="shrink-0">•</span>
                            <span className="whitespace-pre-wrap">{line}</span>
                          </div>
                        ))
                    ) : termsAndConditions.termsType === 'lightingControls' ? (
                      // Preview for Lighting Controls: each non-empty line from lightingControlsTerms
                      (termsAndConditions.lightingControlsTerms || '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0)
                        .map((line, idx) => (
                          <div key={idx} className="flex gap-1">
                            <span className="shrink-0">•</span>
                            <span className="whitespace-pre-wrap">{line}</span>
                          </div>
                        ))
                    ) : (
                      // Preview for LED Lights: structured terms using individual fields
                      <>
                        <div className="flex gap-1">
                          <span className="shrink-0">1.</span>
                          <span>
                            The prices quoted on {termsAndConditions.deliveryLocation}.
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <span className="shrink-0">2.</span>
                          <span>
                            Delivery: Within {termsAndConditions.deliveryTime} from the date of PO and advance payment.
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <span className="shrink-0">3.</span>
                          <span>Payment Terms: {termsAndConditions.paymentTerms}.</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="shrink-0">4.</span>
                          <span>The quoted products are {termsAndConditions.productMake}</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="shrink-0">5.</span>
                          <span>Validity of offer: {termsAndConditions.validityDays}</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="shrink-0">6.</span>
                          <span>{termsAndConditions.vatNote}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Delivery Location */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    1. Delivery Location
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.deliveryLocation}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                    placeholder="e.g., DDP Bahrain"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* Delivery Time */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    2. Delivery Time
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.deliveryTime}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, deliveryTime: e.target.value }))}
                    placeholder="e.g., 8-10 Weeks"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    3. Payment Terms
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.paymentTerms}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    placeholder="e.g., 50% advance and balance 50% on delivery"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* Product Make */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    4. Product Make
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.productMake}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, productMake: e.target.value }))}
                    placeholder="e.g., Qlite UK make"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* Validity Days */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    5. Validity of Offer
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.validityDays}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, validityDays: e.target.value }))}
                    placeholder="e.g., 45 days"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* VAT Note */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    6. VAT Note
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.vatNote}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, vatNote: e.target.value }))}
                    placeholder="e.g., VAT will charged as per applicable government regulations"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                </div>

                {/* Sales Person Name */}
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sales Person Name
                  </label>
                  <input
                    type="text"
                    value={termsAndConditions.salesPersonName}
                    onChange={(e) => setTermsAndConditions(prev => ({ ...prev, salesPersonName: e.target.value }))}
                    placeholder="Enter your name (will appear in closing)"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${isDarkMode
                      ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    Your name will appear after "Yours Sincerely" in the quotation
                  </p>
                </div>

                {/* Preview */}
                <div className={`mt-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}>
                  <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Preview:
                  </h4>
                  <div className={`text-xs space-y-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <p>1. The prices quoted on {termsAndConditions.deliveryLocation}.</p>
                    <p>2. Delivery: Within {termsAndConditions.deliveryTime} from the date of PO and advance payment.</p>
                    <p>3. Payment Terms: {termsAndConditions.paymentTerms}.</p>
                    <p>4. The quoted products are {termsAndConditions.productMake}</p>
                    <p>5. Validity of offer: {termsAndConditions.validityDays}</p>
                    <p>6. {termsAndConditions.vatNote}</p>
                    <p className="mt-3">Thanking You</p>
                    <p className="mt-2">Yours Sincerely</p>
                    {termsAndConditions.salesPersonName && (
                      <p className="mt-2 font-semibold">{termsAndConditions.salesPersonName}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t ${isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
              }`}>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editingCartItem && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">
                  Editing cart item
                </p>
                <h2 className="text-white font-bold text-lg">
                  {editingCartItem.sku}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="text-gray-400 hover:text-white text-2xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
              <label className="block text-yellow-400 text-xs font-semibold mb-1">
                💰 Price (INR) — Optional
              </label>
              <input
                type="text"
                value={editSpecs.price || ''}
                onChange={(e) => setEditSpecs((prev: any) => ({
                  ...prev,
                  price: e.target.value
                }))}
                placeholder="Enter price in INR (leave empty if unknown)"
                className="w-full bg-gray-800 border border-yellow-600/50 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Category', key: 'category' },
                { label: 'Wattage', key: 'watt' },
                { label: 'Lumen', key: 'lumen' },
                { label: 'Dimension', key: 'dimension' },
                { label: 'Beam Angle', key: 'beamAngle' },
                { label: 'IP Rating', key: 'ipRating' },
                { label: 'CCT', key: 'cct' },
                { label: 'Dimming', key: 'dimming', options: ['None', 'DALI', '0-10V Dimming', '1-10V Dimming', 'TRIAC', 'Non Dimmable', 'DMX Controlled'] },
                { label: 'Accessories', key: 'accessories', options: ['None', 'Spike', 'Honeycomb Louvre', 'Tree Strap', 'Spread Lens', 'Cowl'] },
                { label: 'Finish', key: 'finish', options: ['None', 'White', 'Black', 'Silver', 'Gold'] },
                { label: 'Reflector Finish', key: 'reflectorFinish', options: ['None', 'Chrome', 'White', 'Black', 'Silver', 'Gold', 'Dark Chrome'] },
              ].map(({ label, key, options }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-gray-400 text-xs font-medium">
                    {label}
                  </label>
                  {options ? (
                    <select
                      value={editSpecs[key] || ''}
                      onChange={(e) => setEditSpecs((prev: any) => ({
                        ...prev,
                        [key]: e.target.value
                      }))}
                      className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select {label}</option>
                      {editSpecs[key] && !options.includes(editSpecs[key]) && (
                        <option value={editSpecs[key]}>{editSpecs[key]}</option>
                      )}
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editSpecs[key] || ''}
                      onChange={(e) => setEditSpecs((prev: any) => ({
                        ...prev,
                        [key]: e.target.value
                      }))}
                      className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 mb-3">
              <span className="text-gray-400 text-sm font-medium">
                Quantity
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditSpecs((prev: any) => ({
                    ...prev,
                    quantity: Math.max(1, (prev.quantity || 1) - 1)
                  }))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold cursor-pointer transition-all"
                >
                  −
                </button>
                <span className="text-white font-bold text-lg w-8 text-center">
                  {editSpecs.quantity || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setEditSpecs((prev: any) => ({
                    ...prev,
                    quantity: (prev.quantity || 1) + 1
                  }))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold cursor-pointer transition-all"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!editSpecs.price || editSpecs.price === '0') {
                  setShowNoPriceConfirm(true);
                  return;
                }
                updateCartItem(editingCartItem.cartItemId, {
                  ...editingCartItem,
                  category: editSpecs.category,
                  watt: editSpecs.watt || editingCartItem.watt,
                  lumen: editSpecs.lumen,
                  dimension: editSpecs.dimension,
                  beamAngle: editSpecs.beamAngle,
                  ipRating: editSpecs.ipRating,
                  cct: editSpecs.cct,
                  dimming: editSpecs.dimming,
                  accessories: editSpecs.accessories,
                  finish: editSpecs.finish,
                  reflectorFinish: editSpecs.reflectorFinish,
                  price: editSpecs.price ? Number(editSpecs.price) : editingCartItem.price,
                  quantity: editSpecs.quantity || 1,
                });
                setEditingCartItem(null);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-all text-sm"
            >
              Update Cart Item
            </button>
          </div>
        </div>
      )}

      {showDownloadConfirm && !showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-2xl border border-gray-700">

            <div className="mb-4">
              <h2 className="text-white font-bold text-lg mb-1">
                Ready to download?
              </h2>
              <p className="text-gray-400 text-sm">
                This will be saved as a quotation.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {showDownloadConfirm === 'pdf' && (
                <button
                  type="button"
                  onClick={async () => {
                    const url = await generatePdfBlob();
                    if (url) {
                      setPreviewUrl(url);
                      setShowPreview(true);
                    }
                  }}
                  className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-blue-300 rounded-lg text-sm font-medium cursor-pointer transition-all border border-blue-700"
                >
                  👁 Preview PDF first
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowDownloadConfirm(null);
                  if (showDownloadConfirm === 'pdf') exportPDF();
                  else exportExcel();
                }}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold cursor-pointer transition-all"
              >
                Download {showDownloadConfirm === 'pdf' ? 'PDF' : 'Excel'}
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadConfirm(null)}
                className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">

          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm">
              PDF Preview
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setShowDownloadConfirm('pdf');
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewUrl(null);
                  setShowDownloadConfirm(null);
                  exportPDF();
                }}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewUrl(null);
                  setShowDownloadConfirm(null);
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <iframe
            src={previewUrl}
            className="flex-1 w-full"
            title="PDF Preview"
          />
        </div>
      )}

      {showNoPriceConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-yellow-600/50 shadow-2xl">

            <div className="mb-4 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="text-white font-bold text-base mb-1">
                No price added!
              </h3>
              <p className="text-gray-400 text-sm">
                This item will show ₹0.00 in the quotation.
                Do you want to continue without a price?
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowNoPriceConfirm(false)}
                className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                Add Price
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  updateCartItem(editingCartItem.cartItemId, {
                    ...editingCartItem,
                    category: editSpecs.category,
                    watt: editSpecs.watt || editingCartItem.watt,
                    lumen: editSpecs.lumen,
                    dimension: editSpecs.dimension,
                    beamAngle: editSpecs.beamAngle,
                    ipRating: editSpecs.ipRating,
                    cct: editSpecs.cct,
                    dimming: editSpecs.dimming,
                    accessories: editSpecs.accessories,
                    finish: editSpecs.finish,
                    reflectorFinish: editSpecs.reflectorFinish,
                    price: 0,
                    quantity: editSpecs.quantity || 1,
                  });
                  setEditingCartItem(null);
                }}
                className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm cursor-pointer"
              >
                Continue without price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Details Popup Modal */}
      {showMissingDetailsPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className={`max-w-md w-full rounded-xl p-6 text-center ${isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'}`}>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Missing Details</h3>
            <p className={`mb-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Please fill in all required details (Email, Mobile, Attn (Name), and Company) before downloading your quotation.
            </p>
            <button
              onClick={() => setShowMissingDetailsPopup(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-all"
            >
              Okay, I'll fill them
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
