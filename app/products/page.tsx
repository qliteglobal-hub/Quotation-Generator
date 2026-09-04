'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import CurrencySelector from '@/components/CurrencySelector';
import CurrencyInfo from '@/components/CurrencyInfo';
import { Search, Filter, X, ChevronDown, ChevronUp, Package, ShoppingCart, Sparkles, Sun, Moon, FileText, Download, File, Award, ChevronLeft, ChevronRight, Plus, Minus, Settings } from 'lucide-react';
import { getApplicationFromIpRating } from '@/lib/ipRatingUtils';
import ProductStructuredData from '@/components/ProductStructuredData';

type IpRatingPrice = {
  rating: string;
  price: number;
};

type CabinetMaterialVariant = {
  material: string;
  price: number;
};

type PriceVariant = {
  channels?: number;
  size?: string;
  price: number;
};

type Product = {
  _id: string;
  sku: string;
  name?: string; // Made optional for lighting controls
  category: string;
  categoryFilter?: string;
  territory?: string;
  application?: string;

  watt?: number;
  lumen?: string;
  beamAngle?: string;
  dimension?: string;
  cct?: string;
  dimming?: string;
  accessories?: string;
  finish?: string;
  reflectorFinish?: string;
  wattageVariants?: { watt: number; lumen: string; dimension: string; }[];
  price: number;
  // LED display specific
  pixelPitch?: string;
  totalResolution?: string;
  sqft?: number;
  ipRating?: string[];
  ipRatings?: IpRatingPrice[];

  cabinetMaterialVariants?: CabinetMaterialVariant[];
  // Lighting control specific
  productImage?: string;
  productCode?: string;
  productName?: string;
  description?: string;
  priceVariants?: PriceVariant[];
  controlType?: string;
  protocol?: string;
  channels?: number;
  loadCapacity?: string;
  outputVoltage?: string;
  dimmingRange?: string;
  mounting?: string;
  connectivity?: string;
  compatibility?: string;
  // Common fields
  images?: string[];
  productImages?: string[];
  datasheets?: string[];
  iesFiles?: string[];
  certifications?: string[];
  bisApproval?: string[];
  isoCertificate?: string[];
  cabinetSpecs?: {
    cabinetSize?: string; // W*H in mm, e.g. "960x960"
    cabinetResolution?: string; // e.g. "128x96"
    moduleQuantity?: number;
    pixelDensity?: string; // pixels per sqm
    cabinetWeight?: number; // in kg
    cabinetArea?: number; // in sqm, if provided
    material?: string; // Cabinet material from Cabinet Specifications
    maintenance?: string; // Front/Rear
  };
  cabinetRequired?: number;
  requiredLength?: string;
  requiredWidth?: string;
  selectedCabinetMaterial?: string;
};

type Filters = {
  search: string;
  sku: string;
  category: string;
  application: string;

  watt: string;
  lumen: string;
  beamAngle: string;
  sortBy: string;
  order: 'asc' | 'desc';
};

const wattRanges = [
  { label: '0-10 W', min: 0, max: 10 },
  { label: '10-20 W', min: 10, max: 20 },
  { label: '20-50 W', min: 20, max: 50 },
  { label: '50-100 W', min: 50, max: 100 },
  { label: '100+ W', min: 100, max: Infinity },
];

const lumenRanges = [
  { label: '0-500 Lm', min: 0, max: 500 },
  { label: '500-1000 Lm', min: 500, max: 1000 },
  { label: '1000-2000 Lm', min: 1000, max: 2000 },
  { label: '2000+ Lm', min: 2000, max: Infinity },
];

const FEET_TO_METER = 0.3048;
const METER_TO_FEET = 1 / 0.3048;

// Custom rounding: ≤0.5 rounds down, >0.5 rounds up
const customRound = (value: number): number => {
  const decimal = value - Math.floor(value);
  if (decimal <= 0.5) {
    return Math.floor(value);
  } else {
    return Math.ceil(value);
  }
};

type CabinetArrangement = {
  width: number;
  height: number;
  total: number;
};

const computeCabinetArrangement = (product: Product, widthMeterStr?: string, heightMeterStr?: string): CabinetArrangement | null => {
  const widthMeter = parseFloat(widthMeterStr || '');
  const heightMeter = parseFloat(heightMeterStr || '');

  if (!isFinite(widthMeter) || !isFinite(heightMeter) || widthMeter <= 0 || heightMeter <= 0) return null;

  // Get cabinet size from cabinetSpecs.cabinetSize (stored in mm)
  if (!product.cabinetSpecs?.cabinetSize) return null;

  const parts = product.cabinetSpecs.cabinetSize
    .split(/x|×|\*/i)
    .map(p => parseFloat(p.trim()))
    .filter(n => !isNaN(n) && n > 0);

  if (parts.length < 2) return null;

  // Convert cabinet size from mm to meters
  const cabinetWidthM = parts[0] / 1000;
  const cabinetHeightM = parts[1] / 1000;

  if (cabinetWidthM <= 0 || cabinetHeightM <= 0) return null;

  // Calculate number of cabinets in width and height
  const cabinetsWidth = widthMeter / cabinetWidthM;
  const cabinetsHeight = heightMeter / cabinetHeightM;

  // Apply custom rounding
  const roundedWidth = customRound(cabinetsWidth);
  const roundedHeight = customRound(cabinetsHeight);

  return {
    width: roundedWidth,
    height: roundedHeight,
    total: roundedWidth * roundedHeight
  };
};

const DIMMING_OPTIONS = ['None', 'DALI', '0-10V Dimming', '1-10V Dimming', 'TRIAC', 'Non Dimmable', 'DMX Controlled'];
const ACCESSORIES_OPTIONS = ['None', 'Spike', 'Honeycomb Louvre', 'Tree Strap', 'Spread Lens', 'Cowl'];
const FINISH_OPTIONS = ['None', 'White', 'Black', 'Silver', 'Gold'];
const REFLECTOR_FINISH_OPTIONS = ['None', 'Chrome', 'White', 'Black', 'Silver', 'Gold', 'Dark Chrome'];

export default function ProductsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { addToCart, cart, increaseQuantity, decreaseQuantity, removeFromCart, updateCartItem } = useCart();
  const { formatPrice } = useCurrency();

  // Product type state
  const [productType, setProductType] = useState<'led-lights' | 'led-displays' | 'lighting-controls'>('led-lights');

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [customizeProduct, setCustomizeProduct] = useState<any>(null);
  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [customSpecs, setCustomSpecs] = useState<any>({});
  const [dimmingCustom, setDimmingCustom] = useState(false);
  const [accessoriesCustom, setAccessoriesCustom] = useState(false);
  const [finishCustom, setFinishCustom] = useState(false);
  const [reflectorFinishCustom, setReflectorFinishCustom] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [selectedIpRatings, setSelectedIpRatings] = useState<Record<string, string>>({});
  const [selectedWattVariants, setSelectedWattVariants] = useState<Record<string, number>>({});

  const [selectedBeamAngles, setSelectedBeamAngles] = useState<Record<string, string>>({});
  const [selectedCcts, setSelectedCcts] = useState<Record<string, string>>({});
  const [selectedLumens, setSelectedLumens] = useState<Record<string, string>>({});
  const [selectedCabinetMaterials, setSelectedCabinetMaterials] = useState<Record<string, number>>({});
  const [selectedPriceVariants, setSelectedPriceVariants] = useState<Record<string, number>>({});
  // For LED displays: user-entered required square feet (no calculations yet)
  const [requiredSqft, setRequiredSqft] = useState<Record<string, string>>({});
  const [requiredLength, setRequiredLength] = useState<Record<string, string>>({});
  const [requiredWidth, setRequiredWidth] = useState<Record<string, string>>({});
  const [cabinetCounts, setCabinetCounts] = useState<Record<string, string>>({});
  const [manualCabinetArrangements, setManualCabinetArrangements] = useState<Record<string, { width: string; height: string }>>({});
  const [showFilters, setShowFilters] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<string>('All');

  // Initialize theme from localStorage so cart page can share the same theme
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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recentlyAdded, setRecentlyAdded] = useState<boolean>(false);
  const [itemsPerPage] = useState<number>(30);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    sku: '',
    category: '',
    application: '',
    watt: '',
    lumen: '',
    beamAngle: '',
    sortBy: 'sku',
    order: 'asc',
  });

  // Type-specific filters for LED Displays
  const [displayFilters, setDisplayFilters] = useState({
    pixelPitch: '',
    application: '',
    ipRating: '',
  });

  // Type-specific filters for Lighting Controls
  const [controlFilters, setControlFilters] = useState({
    controlType: '',
    protocol: '',
    application: '',
  });

  // Load Length/Width/Cabinet from cart items on mount for LED displays
  useEffect(() => {
    if (productType !== 'led-displays') return;
    cart.forEach(item => {
      // Only process non-driver items (products)
      if (item.isDriver) return;
      
      const productItem = item as any; // Type assertion since we know it's a product
      if (productItem.requiredLength) {
        setRequiredLength(prev => ({ ...prev, [item._id]: productItem.requiredLength || '' }));
      }
      if (productItem.requiredWidth) {
        setRequiredWidth(prev => ({ ...prev, [item._id]: productItem.requiredWidth || '' }));
      }
      if (productItem.cabinetRequired) {
        setCabinetCounts(prev => ({ ...prev, [item._id]: String(productItem.cabinetRequired) }));
      }
    });
  }, [cart, productType]);

  const [filterOptions, setFilterOptions] = useState({
    skus: [] as string[],
    categories: [] as string[],
    applications: [] as string[],
    beamAngles: [] as string[],
    // LED Display options
    pixelPitches: [] as string[],
    displayApplications: [] as string[],
    ipRatings: [] as string[],
    // Lighting Control options
    controlTypes: [] as string[],
    protocols: [] as string[],
    controlApplications: [] as string[],
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;

        if (key === 'watt' || key === 'lumen') {
          const [min, max] = value.split('-');
          params.append(`${key}Min`, min);
          params.append(`${key}Max`, max);
        } else {
          params.append(key, value);
        }
      });

      // Add LED Display specific filters
      if (productType === 'led-displays') {
        Object.entries(displayFilters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });
      }

      // Add Lighting Control specific filters
      if (productType === 'lighting-controls') {
        Object.entries(controlFilters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });
      }

      // Select API endpoint based on product type
      const endpoint = productType === 'led-lights' ? '/api/products' 
                     : productType === 'led-displays' ? '/api/led-displays'
                     : '/api/lighting-controls';

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, productType, displayFilters, controlFilters]);

  const fetchFilterOptions = async () => {
    try {
      // Select API endpoint based on product type
      const endpoint = productType === 'led-lights' ? '/api/products' 
                     : productType === 'led-displays' ? '/api/led-displays'
                     : '/api/lighting-controls';

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!data.error) {
        const products = data as any[];
        
        // Use categoryFilter if available, otherwise fallback to extracting from category
        const categoryFilters = products
          .map(p => {
            if (p.categoryFilter) return p.categoryFilter;
            // Fallback: extract last two words from category
            if (!p.category) return null;
            const words = p.category.trim().split(/\s+/);
            return words.length === 1 ? words[0] : words.slice(-2).join(' ');
          })
          .filter((v): v is string => Boolean(v));
        
        // Custom numeric sort function for values with units
        const numericSort = (a: string, b: string) => {
          const numA = parseFloat(a.replace(/[^\d.-]/g, ''));
          const numB = parseFloat(b.replace(/[^\d.-]/g, ''));
          return numA - numB;
        };
        
        // Sort function that puts non-numeric values (like "NA") at the end
        const numericSortWithNALast = (a: string, b: string) => {
          const numA = parseFloat(a.replace(/[^\d.-]/g, ''));
          const numB = parseFloat(b.replace(/[^\d.-]/g, ''));
          const isANumeric = !isNaN(numA);
          const isBNumeric = !isNaN(numB);
          
          if (isANumeric && isBNumeric) return numA - numB;
          if (isANumeric && !isBNumeric) return -1; // a comes first
          if (!isANumeric && isBNumeric) return 1;  // b comes first
          return a.localeCompare(b); // both non-numeric, sort alphabetically
        };
        
        // Build filter options based on product type
        if (productType === 'led-lights') {
          setFilterOptions({
            skus: [...new Set(products.map(p => p.sku).filter((v): v is string => Boolean(v)))].sort() as string[],
            categories: [...new Set(categoryFilters)].sort() as string[],
            applications: [...new Set(products.map(p => p.application).filter((v): v is string => Boolean(v)))].sort() as string[],
            beamAngles: [...new Set(products.map(p => p.beamAngle).filter((v): v is string => Boolean(v)))].sort(numericSort) as string[],
            pixelPitches: [],
            displayApplications: [],
            ipRatings: [],
            controlTypes: [],
            protocols: [],
            controlApplications: [],
          });
        } else if (productType === 'led-displays') {
          setFilterOptions({
            skus: [...new Set(products.map(p => p.sku).filter((v): v is string => Boolean(v)))].sort() as string[],
            categories: [...new Set(categoryFilters)].sort() as string[],
            applications: [],
            beamAngles: [],
            pixelPitches: [...new Set(products.map(p => p.pixelPitch).filter((v): v is string => Boolean(v)))].sort(numericSort) as string[],
            displayApplications: [...new Set(products.map(p => p.application).filter((v): v is string => Boolean(v)))].sort() as string[],
            ipRatings: [...new Set(products.map(p => p.ipRating).filter((v): v is string => Boolean(v)))].sort() as string[],
            controlTypes: [],
            protocols: [],
            controlApplications: [],
          });
        } else if (productType === 'lighting-controls') {
          setFilterOptions({
            skus: [...new Set(products.map(p => p.sku).filter((v): v is string => Boolean(v)))].sort() as string[],
            categories: [...new Set(categoryFilters)].sort() as string[],
            applications: [],
            beamAngles: [],
            pixelPitches: [],
            displayApplications: [],
            ipRatings: [],
            controlTypes: [...new Set(products.map(p => p.controlType).filter((v): v is string => Boolean(v)))].sort() as string[],
            protocols: [...new Set(products.map(p => p.protocol).filter((v): v is string => Boolean(v)))].sort() as string[],
            controlApplications: [...new Set(products.map(p => p.application).filter((v): v is string => Boolean(v)))].sort() as string[],
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  useEffect(() => { fetchFilterOptions(); }, [productType]);
  
  // Debounced fetch to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300); // Wait 300ms after user stops typing
    
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      order: prev.sortBy === sortBy && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resetFilters = () => {
    setRecentlyAdded(false);
    setFilters({
      search: '',
      sku: '',
      category: '',
      application: '',
      watt: '',
      lumen: '',
      beamAngle: '',
      sortBy: 'sku',
      order: 'asc',
    });
    setDisplayFilters({
      pixelPitch: '',
      application: '',
      ipRating: '',
    });
    setControlFilters({
      controlType: '',
      protocol: '',
      application: '',
    });
    setCurrentPage(1); // Reset to first page when filters are cleared
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'sku' && v !== 'asc').length
    + Object.values(displayFilters).filter(v => v).length
    + Object.values(controlFilters).filter(v => v).length;

  // Handle file download with authentication check
  const handleFileDownload = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (!session) {
      e.preventDefault();
      setShowLoginModal(true);
    }
    // If session exists, allow default download behavior
  };

  // Sort products locally if "Recently Added" is selected
  let displayProducts = [...products];
  if (recentlyAdded) {
    displayProducts.sort((a, b) => {
      // Use _id string comparison which inherently sorts by creation time since ObjectIDs start with a timestamp
      const idA = a._id?.toString() || '';
      const idB = b._id?.toString() || '';
      return idB.localeCompare(idA);
    });
  }

  // Filter by territory
  if (selectedTerritory !== 'All') {
    displayProducts = displayProducts.filter(p => p.territory === selectedTerritory || p.territory === 'Both');
  }

  // Pagination calculations
  const totalPages = Math.ceil(displayProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = displayProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, recentlyAdded]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
      {/* SEO: Structured Data for Products */}
      <ProductStructuredData products={products} />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className={`text-3xl md:text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Product Quotation</h1>
               {/* <div className="inline-flex items-center gap-2 bg-yellow-400/10 backdrop-blur-sm border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>Build Your Quote</span>
                </div> */}
              </div>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Browse and select products for your quotation</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Theme Toggle Button */}
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  isDarkMode 
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                    : 'bg-gray-800 hover:bg-gray-900 text-white border border-gray-700'
                }`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </>
                )}
              </button>
              <CurrencySelector />
              <CurrencyInfo />
              {!loading && products.length > 0 && (
                <div className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-4 py-2 rounded-lg font-semibold text-sm">
                  {products.length} Products
                </div>
              )}
            </div>
          </div>

          {/* Product Type Tabs */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => {
                setProductType('led-lights');
                setCurrentPage(1);
                setDisplayFilters({ pixelPitch: '', application: '', ipRating: '' });
                setControlFilters({ controlType: '', protocol: '', application: '' });
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all ${
                productType === 'led-lights'
                  ? isDarkMode
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                    : 'bg-yellow-400 text-black shadow-lg'
                  : isDarkMode
                    ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              <Package className="w-4 h-4" />
              LED Lights
            </button>
            <button
              onClick={() => {
                setProductType('led-displays');
                setCurrentPage(1);
                setDisplayFilters({ pixelPitch: '', application: '', ipRating: '' });
                setControlFilters({ controlType: '', protocol: '', application: '' });
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all ${
                productType === 'led-displays'
                  ? isDarkMode
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                    : 'bg-yellow-400 text-black shadow-lg'
                  : isDarkMode
                    ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              <Package className="w-4 h-4" />
              LED Displays
            </button>
            <button
              onClick={() => {
                setProductType('lighting-controls');
                setCurrentPage(1);
                setDisplayFilters({ pixelPitch: '', application: '', ipRating: '' });
                setControlFilters({ controlType: '', protocol: '', application: '' });
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all ${
                productType === 'lighting-controls'
                  ? isDarkMode
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                    : 'bg-yellow-400 text-black shadow-lg'
                  : isDarkMode
                    ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
             <Package className="w-4 h-4" />
            Lighting Controls 
            </button>
          </div>
          
          {/* Territory Filter */}
          <div className="flex gap-2 mt-4">
            {['All', 'India', 'Middle East'].map(territory => (
              <button
                key={territory}
                onClick={() => { setSelectedTerritory(territory); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  selectedTerritory === territory
                    ? isDarkMode
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {territory}
              </button>
            ))}
          </div>
        </div>

        {/* Continuous  Banner */}
        <div className={`mb-6 overflow-hidden rounded-lg ${
          isDarkMode 
            ? 'bg-gradient-to-r from-yellow-500/10 via-yellow-400/10 to-yellow-500/10 border border-yellow-400/30' 
            : 'bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 border border-yellow-300'
        }`}>
          <div className="relative flex overflow-x-hidden py-3">
            <div className="flex whitespace-nowrap animate-scroll">
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                ⚠️ Products with unlisted or zero prices are available on request
              </span>
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                For customized quotations or bulk inquiries, please contact our sales team
              </span>
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                New products are added regularly - stay tuned for updates!
              </span>
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                Confirm product availability before finalizing any quotation
              </span>
            </div>
            <div className="absolute top-0 flex whitespace-nowrap py-3 animate-scroll2">
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                ⚠️ Products with unlisted or zero prices are available on request
              </span>   
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                 For customized quotations or bulk inquiries, please contact our sales team
              </span>
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                New products are added regularly - stay tuned for updates!
              </span>
              <span className={`text-sm font-semibold mx-8 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                Confirm product availability before finalizing any quotation
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`rounded-xl mb-6 overflow-hidden transition-colors ${
          isDarkMode 
            ? 'bg-gray-900/50 border border-white/10' 
            : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          <div 
            className={`flex items-center justify-between p-6 cursor-pointer transition-colors ${
              isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-yellow-400" />
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Filters</h2>
              {activeFilterCount > 0 && (
                <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); resetFilters(); }} 
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
              {showFilters ? (
                <ChevronUp className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              ) : (
                <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              )}
            </div>
          </div>

          {showFilters && (
            <div className={`p-6 ${isDarkMode ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Search - Common for all types */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Search className="w-3 h-3 inline mr-1" />
                    Search
                  </label>
                  <input 
                    type="text" 
                    placeholder="Search products..." 
                    value={filters.search} 
                    onChange={e => handleFilterChange('search', e.target.value)} 
                    className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all ${
                      isDarkMode 
                        ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                    }`}
                  />
                </div>

                {/* Category - Common for all types */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>Category</label>
                  <select 
                    value={filters.category} 
                    onChange={e => handleFilterChange('category', e.target.value)} 
                    className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                      isDarkMode 
                        ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                        : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                    }`}
                  >
                    <option value="">All Categories</option>
                    {filterOptions.categories.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>



                {/* SKU - Only for lighting controls */}
                {productType === 'lighting-controls' && (
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>SKU</label>
                    <select
                      value={filters.sku}
                      onChange={e => handleFilterChange('sku', e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                        isDarkMode
                          ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                      }`}
                    >
                      <option value="">All Models</option>
                      {filterOptions.skus.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                )}

                {/* LED Lights Filters */}
                {productType === 'led-lights' && (
                  <>
                    {/* Application */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Application</label>
                      <select 
                        value={filters.application} 
                        onChange={e => handleFilterChange('application', e.target.value)} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Applications</option>
                        {filterOptions.applications.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {/* Wattage */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Wattage</label>
                      <select 
                        value={filters.watt} 
                        onChange={e => handleFilterChange('watt', e.target.value)} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Wattages</option>
                        {wattRanges.map(r => <option key={r.label} value={`${r.min}-${r.max}`}>{r.label}</option>)}
                      </select>
                    </div>

                    {/* Lumen */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Lumen Output</label>
                      <select 
                        value={filters.lumen} 
                        onChange={e => handleFilterChange('lumen', e.target.value)} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Lumens</option>
                        {lumenRanges.map(r => <option key={r.label} value={`${r.min}-${r.max}`}>{r.label}</option>)}
                      </select>
                    </div>


                    {/* Beam Angle */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Beam Angle</label>
                      <select 
                        value={filters.beamAngle} 
                        onChange={e => handleFilterChange('beamAngle', e.target.value)} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Beam Angles</option>
                        {filterOptions.beamAngles.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* LED Displays Filters */}
                {productType === 'led-displays' && (
                  <>
                    {/* Pixel Pitch */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Pixel Pitch</label>
                      <select 
                        value={displayFilters.pixelPitch} 
                        onChange={e => setDisplayFilters(prev => ({ ...prev, pixelPitch: e.target.value }))} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Pixel Pitches</option>
                        {filterOptions.pixelPitches.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {/* Application */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Application</label>
                      <select 
                        value={displayFilters.application} 
                        onChange={e => setDisplayFilters(prev => ({ ...prev, application: e.target.value }))} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All Applications</option>
                        {filterOptions.displayApplications.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {/* IP Rating */}
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>IP Rating</label>
                      <select 
                        value={displayFilters.ipRating} 
                        onChange={e => setDisplayFilters(prev => ({ ...prev, ipRating: e.target.value }))} 
                        className={`w-full px-4 py-2.5 rounded-lg outline-none transition-all cursor-pointer ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400'
                        }`}
                      >
                        <option value="">All IP Ratings</option>
                        {filterOptions.ipRatings.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* Recently Added - Common for all types */}
                <div className="flex flex-col justify-end pb-[2px]">
                  <label className="flex items-center gap-3 cursor-pointer group w-fit">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        checked={recentlyAdded}
                        onChange={(e) => setRecentlyAdded(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className={`w-10 h-5 rounded-full peer-focus:outline-none transition-colors ${
                        isDarkMode ? 'bg-gray-700 peer-checked:bg-yellow-500' : 'bg-gray-300 peer-checked:bg-yellow-400'
                      }`}></div>
                      <div className="absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-full shadow-sm"></div>
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wide transition-colors ${
                      recentlyAdded 
                        ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600') 
                        : (isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-600 group-hover:text-gray-900')
                    }`}>
                      Recently Added
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Products Table */}
        <div className={`rounded-xl overflow-hidden transition-colors ${
          isDarkMode 
            ? 'bg-gray-900/50 border border-white/10' 
            : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          <div className={`p-6 ${isDarkMode ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Products</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Click column headers to sort</p>
          </div>

          <div className="p-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`w-12 h-12 border-4 rounded-full animate-spin mb-4 ${
                  isDarkMode ? 'border-white/10 border-t-yellow-400' : 'border-gray-200 border-t-yellow-400'
                }`}></div>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Fetching the best quotes for you…...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-6 py-4 rounded-lg">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {!loading && !error && products.length === 0 && (
              <div className="text-center py-16">
                <Package className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>No products found</p>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Try adjusting your filters to see more results</p>
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <div className={`overflow-x-auto rounded-lg ${
                isDarkMode ? 'border border-white/10' : 'border border-gray-200'
              }`}>
                <table className="w-full min-w-[1000px]">
                  <thead className={isDarkMode ? 'bg-black/50 border-b border-white/10' : 'bg-gray-50 border-b border-gray-200'}>
                    <tr>
                      <th className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Image</th>
                      {/* Dynamic columns based on product type */}
                      {productType === 'led-lights' && [
                        { label: 'Model', key: 'sku' },
                        { label: 'Category', key: 'category' },
                        { label: 'Application', key: 'application' },

                        { label: 'Watt', key: 'watt' },
                        { label: 'Lumen', key: 'lumen' },
                        { label: 'Dimension', key: 'dimension' },
                        { label: 'Beam Angle', key: 'beamAngle' },
                        { label: 'CCT', key: 'cct' },
                        { label: 'IP Rating', key: 'ipRating' },
                        { label: 'Price', key: 'price' },
                        /* { label: 'Files', key: 'files' }, */
                        { label: 'Action', key: 'action' }
                      ].map(col => (
                        <th 
                          key={col.key} 
                          className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          } ${col.key !== 'action' && col.key !== 'files' ? `cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}` : ''}`}
                          onClick={() => col.key !== 'action' && col.key !== 'files' && handleSortChange(col.key)}
                        >
                          {col.label}
                        </th>
                      ))}
                      {productType === 'led-displays' && [
                        { label: 'Category', key: 'category' },
                        { label: 'Application', key: 'application' },
                        { label: 'IP Rating', key: 'ipRating' },
                        { label: 'Pixel Pitch', key: 'pixelPitch' },
                        { label: 'Cabinet Material', key: 'cabinetMaterial' },
                        { label: 'Screen Inputs (W × H)', key: 'sqft' },
                        { label: 'Cabinet Arrangement', key: 'cabinets' },
                        { label: 'Action', key: 'action' }
                      ].map(col => (
                        <th 
                          key={col.key} 
                          className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          } ${col.key !== 'action' && col.key !== 'files' ? `cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}` : ''}`}
                          onClick={() => col.key !== 'action' && col.key !== 'files' && handleSortChange(col.key)}
                        >
                          {col.label}
                        </th>
                      ))}
                      {productType === 'lighting-controls' && [
                        { label: 'SKU', key: 'sku' },
                        { label: 'Product Name', key: 'productName' },
                        { label: 'Category', key: 'category' },
                        { label: 'Price', key: 'price' },
                        /* { label: 'Files', key: 'files' }, */
                        { label: 'Action', key: 'action' }
                      ].map(col => (
                        <th 
                          key={col.key} 
                          className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          } ${col.key !== 'action' && col.key !== 'files' ? `cursor-pointer ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}` : ''}`}
                          onClick={() => col.key !== 'action' && col.key !== 'files' && handleSortChange(col.key)}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDarkMode ? 'divide-y divide-white/10' : 'divide-y divide-gray-200'}>
                    {paginatedProducts.map((p) => {
                      let currentIpRating: string | undefined;
                      let currentPrice: number;
                      // Calculate price based on IP rating
                      if (p.ipRatings && p.ipRatings.length > 0) {
                        const selectedRating = selectedIpRatings[p._id] || p.ipRatings[0].rating;
                        const ipData = p.ipRatings.find(ip => ip.rating === selectedRating);
                        currentIpRating = selectedRating;
                        currentPrice = ipData?.price || 0;
                      } else if (p.ipRating) {
                        // Handle both string and array
                        currentIpRating = typeof p.ipRating === 'string' ? p.ipRating : (Array.isArray(p.ipRating) && p.ipRating.length > 0 ? (selectedIpRatings[p._id] || p.ipRating[0]) : undefined);
                        currentPrice = p.price;
                      } else {
                        currentIpRating = undefined;
                        currentPrice = p.price;
                      }
                      
                      // Get current beam angle selection
                      const beamAngles = p.beamAngle ? Array.from(new Set(p.beamAngle.split(/[\/,]/).map((angle: string) => angle.trim()).filter(Boolean))) : [];
                      const currentBeamAngle = beamAngles.length > 1 ? (selectedBeamAngles[p._id] || beamAngles[0]) : p.beamAngle;
                      
                      // Get current lumen selection
                      const lumenValues = p.lumen ? p.lumen.split(/[\/,]/).map(lumen => lumen.trim()).filter(Boolean) : [];
                      const currentLumen = lumenValues.length > 1 ? (selectedLumens[p._id] || lumenValues[0]) : p.lumen;
                      
                      const currentWatt = p.watt || 'default';
                      
                      // For LED displays, include dimensions and cabinet material in cart ID
                      let dimensionKey = '';
                      let materialKey = '';
                      let currentCabinetMaterial: string | undefined;
                      
                      if (productType === 'led-displays') {
                        // Get selected cabinet material variant or fallback to cabinetSpecs.material
                        if (p.cabinetMaterialVariants && p.cabinetMaterialVariants.length > 0) {
                          const selectedIdx = selectedCabinetMaterials[p._id] ?? 0;
                          const variant = p.cabinetMaterialVariants[selectedIdx];
                          currentCabinetMaterial = variant.material;
                          currentPrice = variant.price; // Override price with cabinet material variant price
                        } else if (p.cabinetSpecs?.material) {
                          // Fallback to material from Cabinet Specifications
                          currentCabinetMaterial = p.cabinetSpecs.material;
                        }
                        
                        dimensionKey = (requiredLength[p._id] && requiredWidth[p._id])
                          ? `_${requiredLength[p._id]}x${requiredWidth[p._id]}`
                          : '';
                        materialKey = currentCabinetMaterial ? `_${currentCabinetMaterial.replace(/\s+/g, '')}` : '';
                      }
                      
                      const cartItemId = `${p._id}_${currentIpRating || 'default'}_${currentWatt}_${currentBeamAngle || 'default'}_${currentLumen || 'default'}${dimensionKey}${materialKey}`;
                      const isInCart = cart.some(item => item.cartItemId === cartItemId);

                      // Custom layout for LED Displays
                      if (productType === 'led-displays') {
                        const singleIpRating = typeof p.ipRating === 'string' ? p.ipRating : (Array.isArray(p.ipRating) && p.ipRating.length > 0 ? p.ipRating[0] : p.ipRating);
                        
                        return (
                          <tr key={p._id} className={`transition-colors ${
                            isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                          }`}>
                            <td className="px-4 py-4 text-center">
                              {(p.productImages?.length || p.images?.length) ? (
                                <img
                                  src={p.productImages?.[0] || p.images?.[0]}
                                  alt={p.sku}
                                  className={`w-40 h-32 md:w-48 md:h-36 object-contain rounded-2xl border-2 shadow-sm mx-auto ${
                                    isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                                  }`}
                                />
                              ) : (
                                <div className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto ${
                                  isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                                }`}>
                                  <Package className={`w-6 h-6 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                                {p.category}
                              </span>
                            </td>
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {p.application || '-'}
                            </td>
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {singleIpRating || '-'}
                            </td>
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {p.pixelPitch || '-'}
                            </td>
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {p.cabinetMaterialVariants && p.cabinetMaterialVariants.length > 0 ? (
                                <select
                                  value={selectedCabinetMaterials[p._id] ?? 0}
                                  onChange={(e) => {
                                    setSelectedCabinetMaterials(prev => ({
                                      ...prev,
                                      [p._id]: parseInt(e.target.value, 10)
                                    }));
                                  }}
                                  className={`w-full px-3 py-2 rounded-md text-xs outline-none border ${
                                    isDarkMode
                                      ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                      : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                  }`}
                                >
                                  {p.cabinetMaterialVariants.map((variant, idx) => (
                                    <option key={idx} value={idx}>
                                      {variant.material}
                                    </option>
                                  ))}
                                </select>
                              ) : p.cabinetSpecs?.material ? (
                                <span className="text-sm">{p.cabinetSpecs.material}</span>
                              ) : (
                                '-'
                              )}
                            </td>
                            {/* Price column hidden for LED displays as requested */}
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold">Required size <span className="text-[10px] text-gray-500">( Enter in meters)</span></span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={requiredLength[p._id] ?? ''}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setRequiredLength(prev => ({
                                          ...prev,
                                          [p._id]: value,
                                        }));
                                        setRequiredSqft(prev => ({
                                          ...prev,
                                          [p._id]: `${value}x${requiredWidth[p._id] ?? ''}`,
                                        }));
                                        const auto = computeCabinetArrangement(p, value, requiredWidth[p._id]);
                                        setCabinetCounts(prev => ({
                                          ...prev,
                                          [p._id]: auto !== null ? String(auto.total) : prev[p._id] ?? '',
                                        }));
                                      }}
                                      className={`w-20 px-2 py-1 rounded-md text-xs outline-none border [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                        isDarkMode
                                          ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                          : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                      }`}
                                      placeholder="Width (m)"
                                    />
                                    <span className="text-xs">×</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={requiredWidth[p._id] ?? ''}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setRequiredWidth(prev => ({
                                          ...prev,
                                          [p._id]: value,
                                        }));
                                        setRequiredSqft(prev => ({
                                          ...prev,
                                          [p._id]: `${requiredLength[p._id] ?? ''}x${value}`,
                                        }));
                                        const auto = computeCabinetArrangement(p, requiredLength[p._id], value);
                                        setCabinetCounts(prev => ({
                                          ...prev,
                                          [p._id]: auto !== null ? String(auto.total) : prev[p._id] ?? '',
                                        }));
                                      }}
                                      className={`w-20 px-2 py-1 rounded-md text-xs outline-none border [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                        isDarkMode
                                          ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                          : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                      }`}
                                      placeholder="Height (m)"
                                    />
                                  </div>
                                  {(() => {
                                    const lenM = parseFloat(requiredLength[p._id] ?? '');
                                    const widM = parseFloat(requiredWidth[p._id] ?? '');
                                    const hasLen = !isNaN(lenM);
                                    const hasWid = !isNaN(widM);
                                    const toFt = (m: number) => (m * METER_TO_FEET);
                                    const fmt = (ft: number) => ft.toFixed(2);
                                    if (hasLen && hasWid) {
                                      return (
                                        <span className="text-[10px] text-gray-500 mt-1">
                                          ≈ W{fmt(toFt(lenM))}ft × H{fmt(toFt(widM))}ft
                                        </span>
                                      );
                                    }
                                    if (hasLen || hasWid) {
                                      return (
                                        <span className="text-[10px] text-gray-500 mt-1">
                                          {hasLen ? `W${fmt(toFt(lenM))}ft` : ''}
                                          {hasLen && hasWid ? ' · ' : ''}
                                          {hasWid ? `H${fmt(toFt(widM))}ft` : ''}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              <div className="flex flex-col gap-1">
                                {(() => {
                                  const arrangement = computeCabinetArrangement(p, requiredLength[p._id], requiredWidth[p._id]);
                                  if (!arrangement) {
                                    return (
                                      <span className="text-xs text-gray-500">
                                        Enter dimensions
                                      </span>
                                    );
                                  }

                                  const manual = manualCabinetArrangements[p._id];
                                  const displayWidth = manual?.width ? parseInt(manual.width, 10) || 0 : arrangement.width;
                                  const displayHeight = manual?.height ? parseInt(manual.height, 10) || 0 : arrangement.height;
                                  const hasDisplay = displayWidth > 0 && displayHeight > 0;
                                  const total = hasDisplay ? displayWidth * displayHeight : arrangement.total;

                                  if (cabinetCounts[p._id] !== String(total)) {
                                    setCabinetCounts(prev => ({
                                      ...prev,
                                      [p._id]: String(total),
                                    }));
                                  }

                                  return (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm font-semibold text-yellow-400">
                                        W{hasDisplay ? displayWidth : arrangement.width} × H{hasDisplay ? displayHeight : arrangement.height}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        ({total} cabinets)
                                      </span>
                                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                                        <span className="text-gray-500">Edit:</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={manual?.width ?? String(arrangement.width)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setManualCabinetArrangements(prev => ({
                                              ...prev,
                                              [p._id]: {
                                                width: val,
                                                height: prev[p._id]?.height ?? String(arrangement.height),
                                              },
                                            }));
                                          }}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          className={`w-12 px-1 py-0.5 rounded border text-[10px] outline-none ${
                                            isDarkMode
                                              ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                              : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                          }`}
                                        />
                                        <span className="text-gray-500">×</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={manual?.height ?? String(arrangement.height)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setManualCabinetArrangements(prev => ({
                                              ...prev,
                                              [p._id]: {
                                                width: prev[p._id]?.width ?? String(arrangement.width),
                                                height: val,
                                              },
                                            }));
                                          }}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          className={`w-12 px-1 py-0.5 rounded border text-[10px] outline-none ${
                                            isDarkMode
                                              ? 'bg-black border-white/20 text-white focus:border-yellow-400'
                                              : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {/* For LED displays, always show Update button since dimensions can change */}
                              {isInCart ? (
                                <button 
                                  onClick={() => {
                                    if (addingProductId !== cartItemId) {
                                      setAddingProductId(cartItemId);
                                      
                                      // Compute cabinet arrangement and derived values for update
                                      const arrangement = computeCabinetArrangement(p, requiredLength[p._id], requiredWidth[p._id]);
                                      const manual = manualCabinetArrangements[p._id];
                                      const arrWidth = manual?.width ? parseInt(manual.width, 10) || 0 : arrangement?.width;
                                      const arrHeight = manual?.height ? parseInt(manual.height, 10) || 0 : arrangement?.height;
                                      
                                      // Compute suggested size from cabinet arrangement
                                      let suggestedSize: string | undefined;
                                      if (arrangement && arrWidth && arrHeight && p.cabinetSpecs?.cabinetSize) {
                                        const sizeMatch = p.cabinetSpecs.cabinetSize.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                        if (sizeMatch) {
                                          const cabWidMm = parseFloat(sizeMatch[1]);
                                          const cabHeiMm = parseFloat(sizeMatch[2]);
                                          const sugWid = (arrWidth * cabWidMm) / 1000;
                                          const sugHei = (arrHeight * cabHeiMm) / 1000;
                                          suggestedSize = `W${sugWid.toFixed(2)}m × H${sugHei.toFixed(2)}m`;
                                        }
                                      }
                                      
                                      // Compute total resolution from cabinet arrangement
                                      let totalResolution: string | undefined;
                                      if (arrangement && arrWidth && arrHeight && p.cabinetSpecs?.cabinetResolution) {
                                        const resMatch = String(p.cabinetSpecs.cabinetResolution).match(/(\d+)\s*[xX*×]\s*(\d+)/);
                                        if (resMatch) {
                                          const cabWidPx = parseInt(resMatch[1], 10);
                                          const cabHeiPx = parseInt(resMatch[2], 10);
                                          const totalWidPx = arrWidth * cabWidPx;
                                          const totalHeiPx = arrHeight * cabHeiPx;
                                          totalResolution = `W${totalWidPx.toLocaleString()} × H${totalHeiPx.toLocaleString()}`;
                                        }
                                      }
                                      
                                      updateCartItem(cartItemId, {
                                        cabinetRequired: cabinetCounts[p._id]
                                          ? parseInt(cabinetCounts[p._id], 10) || undefined
                                          : undefined,
                                        requiredLength: requiredLength[p._id] || undefined,
                                        requiredWidth: requiredWidth[p._id] || undefined,
                                        suggestedSize,
                                        totalResolution,
                                        cabinetArrangementWidth: arrWidth,
                                        cabinetArrangementHeight: arrHeight,
                                      });
                                      setTimeout(() => setAddingProductId(null), 500);
                                    }
                                  }}
                                  disabled={addingProductId === cartItemId}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    addingProductId === cartItemId
                                    ? 'bg-blue-500 text-white cursor-wait'
                                    : 'bg-green-500 hover:bg-green-600 text-white hover:scale-105'
                                  }`}
                                >
                                  <Settings className="w-4 h-4" />
                                  {addingProductId === cartItemId ? 'Updating...' : 'Update'}
                                </button>
                              ) : (
                                // Show Add to Cart button when item is not in cart
                                <button 
                                  onClick={() => {
                                    if (addingProductId !== cartItemId) {
                                      setAddingProductId(cartItemId);
                                      // Get selected beam angle if multiple exist
                                      const beamAnglesForCart = p.beamAngle ? p.beamAngle.split(/[/,]/).map(angle => angle.trim()).filter(Boolean) : [];
                                      const selectedBeamAngleForCart = beamAnglesForCart.length > 1 ? (selectedBeamAngles[p._id] || beamAnglesForCart[0]) : p.beamAngle;
                                      
                                      // Compute cabinet arrangement and derived values
                                      const arrangement = computeCabinetArrangement(p, requiredLength[p._id], requiredWidth[p._id]);
                                      const manual = manualCabinetArrangements[p._id];
                                      const arrWidth = manual?.width ? parseInt(manual.width, 10) || 0 : arrangement?.width;
                                      const arrHeight = manual?.height ? parseInt(manual.height, 10) || 0 : arrangement?.height;
                                      
                                      // Compute suggested size from cabinet arrangement
                                      let suggestedSize: string | undefined;
                                      if (arrangement && arrWidth && arrHeight && p.cabinetSpecs?.cabinetSize) {
                                        const sizeMatch = p.cabinetSpecs.cabinetSize.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
                                        if (sizeMatch) {
                                          const cabWidMm = parseFloat(sizeMatch[1]);
                                          const cabHeiMm = parseFloat(sizeMatch[2]);
                                          const sugWid = (arrWidth * cabWidMm) / 1000;
                                          const sugHei = (arrHeight * cabHeiMm) / 1000;
                                          suggestedSize = `W${sugWid.toFixed(2)}m × H${sugHei.toFixed(2)}m`;
                                        }
                                      }
                                      
                                      // Compute total resolution from cabinet arrangement
                                      let totalResolution: string | undefined;
                                      if (arrangement && arrWidth && arrHeight && p.cabinetSpecs?.cabinetResolution) {
                                        const resMatch = String(p.cabinetSpecs.cabinetResolution).match(/(\d+)\s*[xX*×]\s*(\d+)/);
                                        if (resMatch) {
                                          const cabWidPx = parseInt(resMatch[1], 10);
                                          const cabHeiPx = parseInt(resMatch[2], 10);
                                          const totalWidPx = arrWidth * cabWidPx;
                                          const totalHeiPx = arrHeight * cabHeiPx;
                                          totalResolution = `W${totalWidPx.toLocaleString()} × H${totalHeiPx.toLocaleString()}`;
                                        }
                                      }
                                      
                                      const productToAdd = {
                                        ...p,
                                        ipRating: currentIpRating,

                                        watt: currentWatt !== 'default' ? currentWatt : p.watt,
                                        beamAngle: selectedBeamAngleForCart,
                                        lumen: currentLumen,
                                        price: currentPrice,
                                        selectedCabinetMaterial: currentCabinetMaterial,
                                        cabinetRequired: cabinetCounts[p._id]
                                          ? parseInt(cabinetCounts[p._id], 10) || undefined
                                          : undefined,
                                        requiredLength: requiredLength[p._id] || undefined,
                                        requiredWidth: requiredWidth[p._id] || undefined,
                                        suggestedSize,
                                        totalResolution,
                                        cabinetArrangementWidth: arrWidth,
                                        cabinetArrangementHeight: arrHeight,
                                      };
                                      
                                      addToCart(productToAdd);
                                      setTimeout(() => setAddingProductId(null), 500);
                                    }
                                  }}
                                  disabled={addingProductId === cartItemId}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    addingProductId === cartItemId
                                    ? 'bg-blue-500 text-white cursor-wait'
                                    : 'bg-yellow-400 hover:bg-yellow-500 text-black hover:scale-105'
                                  }`}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  {addingProductId === cartItemId ? 'Adding...' : 'Add to Cart'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      // Custom layout for Lighting Controls
                      if (productType === 'lighting-controls') {
                        // Calculate price based on selected variant
                        let displayPrice = p.price || 0;
                        let selectedVariant = null;
                        
                        if (p.priceVariants && p.priceVariants.length > 0) {
                          const selectedIdx = selectedPriceVariants[p._id] ?? 0;
                          selectedVariant = p.priceVariants[selectedIdx];
                          displayPrice = selectedVariant?.price || p.price || 0;
                        }
                        
                        const cartItemId = `${p._id}_${selectedVariant?.channels || 'default'}_${selectedVariant?.size || 'default'}_lighting-control`;
                        // Check if THIS SPECIFIC variant is in cart
                        const isInCart = cart.some(item => item.cartItemId === cartItemId);
                        
                        return (
                          <tr key={p._id} className={`transition-colors ${
                            isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                          }`}>
                            <td className="px-4 py-4 text-center">
                              {/* Prioritize productImage, then fall back to productImages/images */}
                              {(p.productImage || p.productImages?.length || p.images?.length) ? (
                                <img 
                                  src={p.productImage || p.productImages?.[0] || p.images?.[0]} 
                                  alt={p.productName || p.sku} 
                                  className={`w-32 h-24 md:w-40 md:h-32 object-contain rounded-2xl border-2 shadow-sm mx-auto ${
                                    isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'
                                  }`}
                                />
                              ) : (
                                <div className={`w-32 h-24 md:w-40 md:h-32 rounded-2xl flex items-center justify-center mx-auto ${
                                  isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                                }`}>
                                  <Package className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                                </div>
                              )}
                            </td>
                            <td className={`px-4 py-4 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              <div className="flex flex-col gap-1 min-w-[8rem] max-w-[10rem] whitespace-nowrap">
                                <span className="text-base leading-tight break-keep">{p.sku}</span>
                                {selectedVariant?.channels && (
                                  <span className={`text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {selectedVariant.channels} Channel{selectedVariant.channels > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`px-4 py-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              <div className="flex flex-col gap-1 max-w-[18rem]">
                                <span className="text-sm font-medium line-clamp-1">{p.productName || '-'}</span>
                                {p.description && (
                                  <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} line-clamp-2`}>
                                    {p.description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                                {p.category}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {p.priceVariants && p.priceVariants.length > 0 ? (
                                <div className="flex flex-col gap-2 min-w-[140px]">
                                  <select
                                    value={selectedPriceVariants[p._id] ?? 0}
                                    onChange={(e) => {
                                      const newIdx = parseInt(e.target.value);
                                      setSelectedPriceVariants(prev => ({
                                        ...prev,
                                        [p._id]: newIdx
                                      }));
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium cursor-pointer outline-none border transition-colors ${
                                      isDarkMode
                                        ? 'bg-black border-white/20 text-white hover:border-yellow-400/50 focus:border-yellow-400'
                                        : 'bg-white border-gray-300 text-gray-900 hover:border-yellow-400 focus:border-yellow-500'
                                    }`}
                                  >
                                    {p.priceVariants.map((variant: PriceVariant, idx: number) => (
                                      <option key={idx} value={idx}>
                                        {variant.size || 'Standard'}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-base font-bold text-yellow-400">
                                    {formatPrice(displayPrice)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-base font-bold text-yellow-400">
                                  {formatPrice(p.price)}
                                </div>
                              )}
                            </td>
                            {false && (
                            <td className="px-4 py-4">
                              {(p.datasheets?.length || p.certifications?.length || p.bisApproval?.length || p.isoCertificate?.length) ? (
                                <div className="relative group">
                                  <button className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                    isDarkMode 
                                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30' 
                                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
                                  }`}>
                                    <File size={14} />
                                    <span>View Files</span>
                                    <ChevronDown size={12} className="group-hover:translate-y-0.5 transition-transform" />
                                  </button>
                                  
                                  {/* Dropdown Menu */}
                                  <div className={`absolute left-0 top-full mt-1 w-48 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${
                                    isDarkMode 
                                      ? 'bg-gray-800 border border-white/20' 
                                      : 'bg-white border border-gray-200'
                                  }`}>
                                    <div className="py-2">
                                      {p.datasheets?.map((url, idx) => (
                                        <a
                                          key={`ds-${idx}`}
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => handleFileDownload(e, url)}
                                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                            isDarkMode 
                                              ? 'text-gray-300 hover:bg-blue-500/20 hover:text-blue-400' 
                                              : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                          }`}
                                          title="Click to download datasheet"
                                        >
                                          <FileText size={16} className="text-blue-500" />
                                          <span className="font-medium">Datasheet</span>
                                          <Download size={12} className="ml-auto opacity-50" />
                                        </a>
                                      ))}
                                      {p.certifications?.map((url, idx) => (
                                        <a
                                          key={`cert-${idx}`}
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => handleFileDownload(e, url)}
                                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                            isDarkMode 
                                              ? 'text-gray-300 hover:bg-green-500/20 hover:text-green-400' 
                                              : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                                          }`}
                                          title="Click to download certificate"
                                        >
                                          <Award size={16} className="text-green-500" />
                                          <span className="font-medium">Certificate</span>
                                          <Download size={12} className="ml-auto opacity-50" />
                                        </a>
                                      ))}
                                      {p.bisApproval?.map((url, idx) => (
                                        <a
                                          key={`bis-${idx}`}
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => handleFileDownload(e, url)}
                                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                            isDarkMode 
                                              ? 'text-gray-300 hover:bg-orange-500/20 hover:text-orange-400' 
                                              : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
                                          }`}
                                          title="Click to download BIS Approval"
                                        >
                                          <Award size={16} className="text-orange-500" />
                                          <span className="font-medium">BIS Approval</span>
                                          <Download size={12} className="ml-auto opacity-50" />
                                        </a>
                                      ))}
                                      {p.isoCertificate?.map((url, idx) => (
                                        <a
                                          key={`iso-${idx}`}
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => handleFileDownload(e, url)}
                                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                            isDarkMode 
                                              ? 'text-gray-300 hover:bg-teal-500/20 hover:text-teal-400' 
                                              : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700'
                                          }`}
                                          title="Click to download ISO Certificate"
                                        >
                                          <Award size={16} className="text-teal-500" />
                                          <span className="font-medium">ISO Certificate</span>
                                          <Download size={12} className="ml-auto opacity-50" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No files</span>
                              )}
                            </td>
                            )}
                            <td className="px-4 py-4">
                              {isInCart ? (
                                // Show increment/decrement controls when item is in cart
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      const currentQuantity = cart.find(item => item.cartItemId === cartItemId)?.quantity || 0;
                                      if (currentQuantity <= 1) {
                                        removeFromCart(cartItemId);
                                      } else {
                                        decreaseQuantity(cartItemId);
                                      }
                                    }}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                      isDarkMode 
                                        ? 'bg-gray-800 hover:bg-gray-700 text-white border border-white/20' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                                    }`}
                                  >
                                    <Minus size={16} />
                                  </button>
                                  <span className={`min-w-[40px] text-center font-bold text-sm ${
                                    isDarkMode ? 'text-white' : 'text-gray-900'
                                  }`}>
                                    {cart.find(item => item.cartItemId === cartItemId)?.quantity || 0}
                                  </span>
                                  <button 
                                    onClick={() => increaseQuantity(cartItemId)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                      isDarkMode 
                                        ? 'bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-400/30' 
                                        : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                                    }`}
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                              ) : (
                                // Show Add to Cart button when item is not in cart
                                <button
                                  onClick={() => {
                                    if (addingProductId !== cartItemId) {
                                      setAddingProductId(cartItemId);
                                      const productToAdd = {
                                        ...p,
                                        price: displayPrice,
                                        selectedVariant: selectedVariant,
                                        cartItemId,
                                        // Flag so cart UI knows this is a lighting control item
                                        isLightingControl: true,
                                      } as any;
                                      
                                      addToCart(productToAdd);
                                      setTimeout(() => setAddingProductId(null), 500);
                                    }
                                  }}
                                  disabled={addingProductId === cartItemId}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    addingProductId === cartItemId
                                    ? 'bg-blue-500 text-white cursor-wait'
                                    : 'bg-yellow-400 hover:bg-yellow-500 text-black hover:scale-105'
                                  }`}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  {addingProductId === cartItemId ? 'Adding...' : 'Add to Cart'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      // Default layout for LED Lights and Lighting Controls
                      return (
                        <tr key={p._id} className={`transition-colors ${
                          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                        }`}>
                          <td className="px-4 py-4 text-center">
                            {/* Prioritize S3 productImages, then fall back to legacy images */}
                            {(p.productImages?.length || p.images?.length) ? (
                              <img 
                                src={p.productImages?.[0] || p.images?.[0]} 
                                alt={p.sku} 
                                className={`w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border-2 mx-auto ${
                                  isDarkMode ? 'border-white/10' : 'border-gray-200'
                                }`}
                              />
                            ) : (
                              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-lg flex items-center justify-center mx-auto ${
                                isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                              }`}>
                                <Package className={`w-6 h-6 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                              </div>
                            )}
                          </td>
                          <td className={`px-4 py-4 text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.sku}</td>
                          <td className="px-4 py-4">
                            <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                              {p.category}
                            </span>
                          </td>
                          <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {(() => {
                              // Get currently selected IP rating for this product
                              const currentIpRatingForApp = selectedIpRatings[p._id] || 
                                (p.ipRatings && p.ipRatings.length > 0 ? p.ipRatings[0].rating : 
                                (p.ipRating && p.ipRating.length > 0 ? p.ipRating[0] : null));
                              
                              // Calculate application based on selected IP rating
                              const dynamicApplication = currentIpRatingForApp 
                                ? getApplicationFromIpRating(currentIpRatingForApp)
                                : (p.application || 'Indoor');
                              
                              return dynamicApplication;
                            })()}
                          </td>
                          <td className={`px-4 py-4 text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {p.wattageVariants && p.wattageVariants.length > 0 ? (
                              <select
                                value={selectedWattVariants[p._id] ?? 0}
                                onChange={(e) => setSelectedWattVariants(prev => ({
                                  ...prev, [p._id]: Number(e.target.value)
                                }))}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-colors ${
                                  isDarkMode
                                    ? 'bg-gray-800 border border-white/20 text-gray-300 hover:border-yellow-400/50'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
                                }`}
                              >
                                {p.wattageVariants.map((v: any, idx: number) => (
                                  <option key={idx} value={idx}>{v.watt}W</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {p.watt ? `${p.watt}${String(p.watt).toUpperCase().includes('W') ? '' : 'W'}` : '-' }
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              const selectedVariantIdx = selectedWattVariants[p._id] ?? 0;
                              const currentVariant = p.wattageVariants?.[selectedVariantIdx];
                              
                              if (currentVariant?.lumen) {
                                return (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold inline-block ${
                                    isDarkMode
                                      ? 'bg-gray-800 border border-white/20 text-gray-300'
                                      : 'bg-white border border-gray-300 text-gray-700'
                                  }`}>
                                    {currentVariant.lumen}
                                  </span>
                                );
                              }

                              if (!p.lumen || p.lumen === '-') return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                              
                              // Parse lumen values - split by / or comma
                              const lumenValues = p.lumen.split(/[\/,]/).map(lumen => lumen.trim()).filter(Boolean);
                              
                              if (lumenValues.length === 1) {
                                const displayValue = lumenValues[0].toLowerCase().includes('lm') ? lumenValues[0] : `${lumenValues[0]} lm`;
                                return (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold inline-block ${
                                    isDarkMode
                                      ? 'bg-gray-800 border border-white/20 text-gray-300'
                                      : 'bg-white border border-gray-300 text-gray-700'
                                  }`}>
                                    {displayValue}
                                  </span>
                                );
                              } else if (lumenValues.length > 1) {
                                return (
                                  <select
                                    value={selectedLumens[p._id] || lumenValues[0]}
                                    onChange={(e) => setSelectedLumens(prev => ({ ...prev, [p._id]: e.target.value }))}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-colors ${
                                      isDarkMode
                                        ? 'bg-gray-800 border border-white/20 text-gray-300 hover:border-yellow-400/50'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
                                    }`}
                                  >
                                    {lumenValues.map((lumen) => {
                                      const displayValue = lumen.toLowerCase().includes('lm') ? lumen : `${lumen} lm`;
                                      return (
                                        <option key={lumen} value={lumen}>{displayValue}</option>
                                      );
                                    })}
                                  </select>
                                );
                              }
                              return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              const selectedIdx = selectedWattVariants[p._id] ?? 0;
                              const currentVariant = p.wattageVariants?.[selectedIdx];
                              const displayDimension = currentVariant?.dimension || p.dimension;
                              
                              return displayDimension ? (
                                <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {displayDimension}
                                </span>
                              ) : (
                                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              if (!p.beamAngle || p.beamAngle === '-') return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                              
                              // Parse beam angles - split by / or comma
                              const beamAngles = Array.from(new Set(p.beamAngle.split(/[\/,]/).map((angle: string) => angle.trim()).filter(Boolean)));
                              
                              if (beamAngles.length === 1) {
                                return (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold inline-block ${
                                    isDarkMode
                                      ? 'bg-gray-800 border border-white/20 text-gray-300'
                                      : 'bg-white border border-gray-300 text-gray-700'
                                  }`}>
                                    {beamAngles[0]}
                                  </span>
                                );
                              } else if (beamAngles.length > 1) {
                                return (
                                  <select
                                    value={selectedBeamAngles[p._id] || beamAngles[0]}
                                    onChange={(e) => setSelectedBeamAngles(prev => ({ ...prev, [p._id]: e.target.value }))}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-colors ${
                                      isDarkMode
                                        ? 'bg-gray-800 border border-white/20 text-gray-300 hover:border-yellow-400/50'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
                                    }`}
                                  >
                                    {beamAngles.map((angle) => (
                                      <option key={angle} value={angle}>{angle}</option>
                                    ))}
                                  </select>
                                );
                              }
                              return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              if (!p.cct || p.cct === '-') return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                              
                              // Parse CCT - split by / or comma
                              const ccts = Array.from(new Set(p.cct.split(/[\/,]/).map((c: string) => c.trim()).filter(Boolean)));
                              
                              if (ccts.length === 1) {
                                return (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold inline-block ${
                                    isDarkMode
                                      ? 'bg-gray-800 border border-white/20 text-gray-300'
                                      : 'bg-white border border-gray-300 text-gray-700'
                                  }`}>
                                    {ccts[0]}
                                  </span>
                                );
                              } else if (ccts.length > 1) {
                                return (
                                  <select
                                    value={selectedCcts[p._id] || ccts[0]}
                                    onChange={(e) => setSelectedCcts(prev => ({ ...prev, [p._id]: e.target.value }))}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-colors ${
                                      isDarkMode
                                        ? 'bg-gray-800 border border-white/20 text-gray-300 hover:border-yellow-400/50'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
                                    }`}
                                  >
                                    {ccts.map((c: string) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                );
                              }
                              return <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>-</span>;
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            {p.ipRatings && p.ipRatings.length > 0 ? (
                              p.ipRatings.length === 1 ? (
                                <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                                  {p.ipRatings[0].rating}
                                </span>
                              ) : (
                                <select
                                  value={selectedIpRatings[p._id] || p.ipRatings[0].rating}
                                  onChange={(e) => setSelectedIpRatings(prev => ({ ...prev, [p._id]: e.target.value }))}
                                  className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                                >
                                  {p.ipRatings.map((ip) => (
                                    <option key={ip.rating} value={ip.rating}>{ip.rating}</option>
                                  ))}
                                </select>
                              )
                            ) : p.ipRating && p.ipRating.length > 0 ? (
                              (() => {
                                const ipRatingsArray = Array.isArray(p.ipRating) ? p.ipRating : [p.ipRating];
                                return ipRatingsArray.length === 1 ? (
                                  <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                                    {ipRatingsArray[0]}
                                  </span>
                                ) : (
                                  <select
                                    value={selectedIpRatings[p._id] || ipRatingsArray[0]}
                                    onChange={(e) => setSelectedIpRatings(prev => ({ ...prev, [p._id]: e.target.value }))}
                                    className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                                  >
                                    {ipRatingsArray.map((rating) => (
                                      <option key={rating} value={rating}>{rating}</option>
                                    ))}
                                  </select>
                                );
                              })()
                            ) : (
                              <span className="text-gray-500">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-yellow-400">
                            {session ? (
                              formatPrice(currentPrice)
                            ) : (
                              <span className="text-xs text-gray-400 flex items-center gap-1 font-normal">
                                🔒 Login to view
                              </span>
                            )}
                          </td>
                          {false && (
                          <td className="px-4 py-4">
                            {(p.datasheets?.length || p.iesFiles?.length || p.certifications?.length || p.bisApproval?.length || p.isoCertificate?.length) ? (
                              <div className="relative group">
                                <button className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  isDarkMode 
                                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30' 
                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
                                }`}>
                                  <File size={14} />
                                  <span>View Files</span>
                                  <ChevronDown size={12} className="group-hover:translate-y-0.5 transition-transform" />
                                </button>
                                
                                {/* Dropdown Menu */}
                                <div className={`absolute left-0 top-full mt-1 w-48 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${
                                  isDarkMode 
                                    ? 'bg-gray-800 border border-white/20' 
                                    : 'bg-white border border-gray-200'
                                }`}>
                                  <div className="py-2">
                                    {p.datasheets?.map((url, idx) => (
                                      <a
                                        key={`ds-${idx}`}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleFileDownload(e, url)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-300 hover:bg-blue-500/20 hover:text-blue-400' 
                                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                        }`}
                                        title="Click to download datasheet"
                                      >
                                        <FileText size={16} className="text-blue-500" />
                                        <span className="font-medium">Datasheet</span>
                                        <Download size={12} className="ml-auto opacity-50" />
                                      </a>
                                    ))}
                                    {p.iesFiles?.map((url, idx) => (
                                      <a
                                        key={`ies-${idx}`}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleFileDownload(e, url)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-300 hover:bg-purple-500/20 hover:text-purple-400' 
                                            : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                                        }`}
                                        title="Click to download IES file"
                                      >
                                        <Download size={16} className="text-purple-500" />
                                        <span className="font-medium">IES File</span>
                                        <Download size={12} className="ml-auto opacity-50" />
                                      </a>
                                    ))}
                                    {p.certifications?.map((url, idx) => (
                                      <a
                                        key={`cert-${idx}`}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleFileDownload(e, url)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-300 hover:bg-green-500/20 hover:text-green-400' 
                                            : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                                        }`}
                                        title="Click to download certificate"
                                      >
                                        <Award size={16} className="text-green-500" />
                                        <span className="font-medium">Certificate</span>
                                        <Download size={12} className="ml-auto opacity-50" />
                                      </a>
                                    ))}
                                    {p.bisApproval?.map((url, idx) => (
                                      <a
                                        key={`bis-${idx}`}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleFileDownload(e, url)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-300 hover:bg-orange-500/20 hover:text-orange-400' 
                                            : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
                                        }`}
                                        title="Click to download BIS Approval"
                                      >
                                        <Award size={16} className="text-orange-500" />
                                        <span className="font-medium">BIS Approval</span>
                                        <Download size={12} className="ml-auto opacity-50" />
                                      </a>
                                    ))}
                                    {p.isoCertificate?.map((url, idx) => (
                                      <a
                                        key={`iso-${idx}`}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleFileDownload(e, url)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-300 hover:bg-teal-500/20 hover:text-teal-400' 
                                            : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700'
                                        }`}
                                        title="Click to download ISO Certificate"
                                      >
                                        <Award size={16} className="text-teal-500" />
                                        <span className="font-medium">ISO Certificate</span>
                                        <Download size={12} className="ml-auto opacity-50" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No files</span>
                            )}
                          </td>
                          )}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {isInCart ? (
                              // Show increment/decrement controls when item is in cart
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    const currentQuantity = cart.find(item => item.cartItemId === cartItemId)?.quantity || 0;
                                    if (currentQuantity <= 1) {
                                      removeFromCart(cartItemId);
                                    } else {
                                      decreaseQuantity(cartItemId);
                                    }
                                  }}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                    isDarkMode 
                                      ? 'bg-gray-800 hover:bg-gray-700 text-white border border-white/20' 
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                                  }`}
                                >
                                  <Minus size={16} />
                                </button>
                                <span className={`min-w-[40px] text-center font-bold text-sm ${
                                  isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {cart.find(item => item.cartItemId === cartItemId)?.quantity || 0}
                                </span>
                                <button 
                                  onClick={() => increaseQuantity(cartItemId)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                    isDarkMode 
                                      ? 'bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-400/30' 
                                      : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                                  }`}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              // Show Add to Cart button when item is not in cart
                              session ? (
                                <button 
                                  onClick={() => {
                                    // Get selected beam angle if multiple exist
                                    const beamAngles = p.beamAngle ? Array.from(new Set(p.beamAngle.split(/[\/,]/).map((angle: string) => angle.trim()).filter(Boolean))) : [];
                                    const selectedBeamAngle = beamAngles.length > 1 ? (selectedBeamAngles[p._id] || beamAngles[0]) : p.beamAngle;

                                    const ccts = p.cct ? Array.from(new Set(p.cct.split(/[\/,]/).map((c: string) => c.trim()).filter(Boolean))) : [];
                                    const selectedCct = ccts.length > 1 ? (selectedCcts[p._id] || ccts[0]) : p.cct;

                                    const selectedIdx = selectedWattVariants[p._id] ?? 0;
                                    const selectedVariant = p.wattageVariants?.[selectedIdx];

                                    setCustomizeProduct({ ...p, price: currentPrice });
                                    setCustomSpecs({
                                      category: p.category || '',
                                      watt: selectedVariant?.watt || currentWatt || p.watt || '',
                                      dimension: selectedVariant?.dimension || p.dimension || '',
                                      beamAngle: selectedBeamAngle || p.beamAngle || '',
                                      lumen: selectedVariant?.lumen || currentLumen || p.lumen || '',
                                      ipRating: currentIpRating || '',
                                      cct: selectedCct || p.cct || '',
                                      price: currentPrice || p.price || '',
                                      dimming: p.dimming || '',
                                      accessories: p.accessories || '',
                                      finish: p.finish || '',
                                      reflectorFinish: p.reflectorFinish || '',
                                      quantity: 1,
                                    });
                                    setDimmingCustom(p.dimming ? !DIMMING_OPTIONS.includes(p.dimming) : false);
                                    setAccessoriesCustom(p.accessories ? !ACCESSORIES_OPTIONS.includes(p.accessories) : false);
                                    setFinishCustom(p.finish ? !FINISH_OPTIONS.includes(p.finish) : false);
                                    setReflectorFinishCustom(p.reflectorFinish ? !REFLECTOR_FINISH_OPTIONS.includes(p.reflectorFinish) : false);
                                  }}
                                  disabled={addingProductId === cartItemId}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    addingProductId === cartItemId
                                    ? 'bg-blue-500 text-white cursor-wait'
                                    : 'bg-yellow-400 hover:bg-yellow-500 text-black hover:scale-105'
                                  }`}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  {addingProductId === cartItemId ? 'Adding...' : 'Add to Cart'}
                                </button>
                              ) : (
                                <a 
                                  href="/login"
                                  className="flex items-center gap-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-md text-sm cursor-pointer transition-all whitespace-nowrap"
                                >
                                  🔒 Login
                                </a>
                              )
                            )}
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium cursor-pointer transition-all"
                            >
                              Details
                            </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && !error && products.length > 0 && totalPages > 1 && (
              <div className={`px-6 py-4 border-t flex items-center justify-between ${
                isDarkMode ? 'bg-gray-900/50 border-white/10' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  Showing {startIndex + 1} to {Math.min(endIndex, products.length)} of {products.length} products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      currentPage === 1
                        ? isDarkMode 
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/10'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      // Show first 2, current page with neighbors, and last 2
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? isDarkMode
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-600 text-white'
                              : isDarkMode
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/10'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      currentPage === totalPages
                        ? isDarkMode 
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/10'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg shadow-2xl max-w-md w-full p-6 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
              }`}>
                <Download size={32} className="text-yellow-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Login Required
              </h3>
              <p className={`mb-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Please log in to download product files, datasheets, and certificates.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-lg">
                {selectedProduct.sku}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-white text-2xl cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Category', value: selectedProduct.category },
                { label: 'Application', value: selectedProduct.application },
                { label: 'Wattage', value: selectedProduct.watt ? selectedProduct.watt + (String(selectedProduct.watt).toUpperCase().includes('W') ? '' : 'W') : null },
                { label: 'Lumen', value: selectedProduct.lumen },
                { label: 'Beam Angle', value: selectedProduct.beamAngle },
                { label: 'Dimension', value: selectedProduct.dimension },
                { label: 'CCT', value: selectedProduct.cct },
                {
                  label: 'IP Rating',
                  value: (() => {
                    if (selectedProduct.ipRating && 
                        selectedProduct.ipRating.length > 0) {
                      return Array.isArray(selectedProduct.ipRating)
                        ? selectedProduct.ipRating.join(', ')
                        : selectedProduct.ipRating;
                    }
                    if (selectedProduct.ipRatings && 
                        selectedProduct.ipRatings.length > 0) {
                      return selectedProduct.ipRatings
                        .map((r: any) => r.rating)
                        .join(', ');
                    }
                    return null;
                  })()
                },
                { label: 'Dimming', value: selectedProduct.dimming },
                { label: 'Accessories', value: selectedProduct.accessories },
                { label: 'Finish', value: selectedProduct.finish },
                { label: 'Reflector Finish', value: selectedProduct.reflectorFinish },
              ]
                .filter(spec => spec.value && spec.value !== '-' && spec.value !== '')
                .map((spec, index) => (
                  <div key={index} className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">{spec.label}</p>
                    <p className="text-white text-sm font-medium">{spec.value}</p>
                  </div>
                ))
              }
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {customizeProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">Adding to cart</p>
                <h2 className="text-white font-bold text-lg">
                  {customizeProduct.sku}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCustomizeProduct(null)}
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
                value={customSpecs.price || ''}
                onChange={(e) => setCustomSpecs((prev: any) => ({
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
                { label: 'Dimension', key: 'dimension' },
                { label: 'Beam Angle', key: 'beamAngle' },
                { label: 'Lumen', key: 'lumen' },
                { label: 'IP Rating', key: 'ipRating' },
                { label: 'CCT', key: 'cct' },
              ].map(({ label, key }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-gray-400 text-xs font-medium">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={customSpecs[key] || ''}
                    onChange={(e) => setCustomSpecs((prev: any) => ({
                      ...prev,
                      [key]: e.target.value
                    }))}
                    placeholder={`Enter ${label}`}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600"
                  />
                </div>
              ))}
              
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs font-medium">Dimming</label>
                <select
                  value={dimmingCustom ? 'Custom' : (customSpecs.dimming || 'None')}
                  onChange={(e) => {
                    if (e.target.value === 'Custom') {
                      setDimmingCustom(true);
                      setCustomSpecs((prev: any) => ({...prev, dimming: ''}));
                    } else {
                      setDimmingCustom(false);
                      setCustomSpecs((prev: any) => ({...prev, dimming: e.target.value === 'None' ? '' : e.target.value}));
                    }
                  }}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {DIMMING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Custom">Custom...</option>
                </select>
                {dimmingCustom && (
                  <input
                    type="text"
                    placeholder="Enter custom dimming"
                    value={customSpecs.dimming || ''}
                    onChange={(e) => setCustomSpecs((prev: any) => ({...prev, dimming: e.target.value}))}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs font-medium">Accessories</label>
                <select
                  value={accessoriesCustom ? 'Custom' : (customSpecs.accessories || 'None')}
                  onChange={(e) => {
                    if (e.target.value === 'Custom') {
                      setAccessoriesCustom(true);
                      setCustomSpecs((prev: any) => ({...prev, accessories: ''}));
                    } else {
                      setAccessoriesCustom(false);
                      setCustomSpecs((prev: any) => ({...prev, accessories: e.target.value === 'None' ? '' : e.target.value}));
                    }
                  }}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {ACCESSORIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Custom">Custom...</option>
                </select>
                {accessoriesCustom && (
                  <input
                    type="text"
                    placeholder="Enter custom accessories"
                    value={customSpecs.accessories || ''}
                    onChange={(e) => setCustomSpecs((prev: any) => ({...prev, accessories: e.target.value}))}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs font-medium">Finish</label>
                <select
                  value={finishCustom ? 'Custom' : (customSpecs.finish || 'None')}
                  onChange={(e) => {
                    if (e.target.value === 'Custom') {
                      setFinishCustom(true);
                      setCustomSpecs((prev: any) => ({...prev, finish: ''}));
                    } else {
                      setFinishCustom(false);
                      setCustomSpecs((prev: any) => ({...prev, finish: e.target.value === 'None' ? '' : e.target.value}));
                    }
                  }}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {FINISH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Custom">Custom...</option>
                </select>
                {finishCustom && (
                  <input
                    type="text"
                    placeholder="Enter custom finish"
                    value={customSpecs.finish || ''}
                    onChange={(e) => setCustomSpecs((prev: any) => ({...prev, finish: e.target.value}))}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs font-medium">Reflector Finish</label>
                <select
                  value={reflectorFinishCustom ? 'Custom' : (customSpecs.reflectorFinish || 'None')}
                  onChange={(e) => {
                    if (e.target.value === 'Custom') {
                      setReflectorFinishCustom(true);
                      setCustomSpecs((prev: any) => ({...prev, reflectorFinish: ''}));
                    } else {
                      setReflectorFinishCustom(false);
                      setCustomSpecs((prev: any) => ({...prev, reflectorFinish: e.target.value === 'None' ? '' : e.target.value}));
                    }
                  }}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {REFLECTOR_FINISH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Custom">Custom...</option>
                </select>
                {reflectorFinishCustom && (
                  <input
                    type="text"
                    placeholder="Enter custom reflector finish"
                    value={customSpecs.reflectorFinish || ''}
                    onChange={(e) => setCustomSpecs((prev: any) => ({...prev, reflectorFinish: e.target.value}))}
                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 mb-3">
              <span className="text-gray-400 text-sm font-medium">
                Quantity
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCustomSpecs((prev: any) => ({
                    ...prev,
                    quantity: Math.max(1, (prev.quantity || 1) - 1)
                  }))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold cursor-pointer transition-all flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-white font-bold text-lg w-8 text-center">
                  {customSpecs.quantity || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomSpecs((prev: any) => ({
                    ...prev,
                    quantity: (prev.quantity || 1) + 1
                  }))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold cursor-pointer transition-all flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!customSpecs.price || customSpecs.price === '0') {
                  setShowNoPriceConfirm(true);
                  return;
                }
                const cartItemId = `${customizeProduct._id}_custom_${Date.now()}`;
                const productToAdd = {
                  ...customizeProduct,
                  category: customSpecs.category || customizeProduct.category,
                  watt: customSpecs.watt || customizeProduct.watt,
                  dimension: customSpecs.dimension || customizeProduct.dimension,
                  beamAngle: customSpecs.beamAngle || customizeProduct.beamAngle,
                  lumen: customSpecs.lumen || customizeProduct.lumen,
                  ipRating: customSpecs.ipRating || customizeProduct.ipRating,
                  cct: customSpecs.cct || customizeProduct.cct,
                  dimming: customSpecs.dimming || customizeProduct.dimming,
                  accessories: customSpecs.accessories || customizeProduct.accessories,
                  finish: customSpecs.finish || customizeProduct.finish,
                  reflectorFinish: customSpecs.reflectorFinish || customizeProduct.reflectorFinish,
                  price: customSpecs.price ? Number(customSpecs.price) : customizeProduct.price,
                  quantity: customSpecs.quantity || 1,
                  cartItemId,
                };
                addToCart(productToAdd, productToAdd.quantity);
                setCustomizeProduct(null);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition-all text-sm"
            >
              Add to Cart
            </button>
          </div>
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
                  const cartItemId = `${customizeProduct._id}_custom_${Date.now()}`;
                  const productToAdd = {
                    ...customizeProduct,
                    category: customSpecs.category || customizeProduct.category,
                    watt: customSpecs.watt || customizeProduct.watt,
                    lumen: customSpecs.lumen || customizeProduct.lumen,
                    dimension: customSpecs.dimension || customizeProduct.dimension,
                    beamAngle: customSpecs.beamAngle || customizeProduct.beamAngle,
                    ipRating: customSpecs.ipRating || customizeProduct.ipRating,
                    cct: customSpecs.cct || customizeProduct.cct,
                    dimming: customSpecs.dimming || customizeProduct.dimming,
                    accessories: customSpecs.accessories || customizeProduct.accessories,
                    finish: customSpecs.finish || customizeProduct.finish,
                    reflectorFinish: customSpecs.reflectorFinish || customizeProduct.reflectorFinish,
                    price: 0,
                    quantity: customSpecs.quantity || 1,
                    cartItemId,
                  };
                  addToCart(productToAdd, productToAdd.quantity);
                  setCustomizeProduct(null);
                }}
                className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm cursor-pointer"
              >
                Continue without price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
