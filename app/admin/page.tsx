"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Upload, FileText, Image as ImageIcon, Award, Zap, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getApplicationFromIpRatings, getApplicationFromIpRating } from "@/lib/ipRatingUtils";
import { useToast } from "@/context/ToastContext";

interface IpRatingPrice {
  rating: string;
  price: number;
}

interface VoltageVariant {
  voltage: string;
  watt: number;
  lumen?: string;
  price: number;
}

interface Product {
  _id: string;
  sku: string;
  category: string;
  categoryFilter?: string; // Main category for filtering
  description?: string; // Product description
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
  ipRatings?: IpRatingPrice[]; // New structure with individual prices
  ipRating?: string[]; // Legacy field for backward compatibility
  price: number; // Legacy field
  images?: string[];
  productImages?: string[]; // S3 uploaded images
  datasheets?: string[]; // S3 uploaded datasheets
  iesFiles?: string[]; // S3 uploaded IES files
  certifications?: string[]; // S3 uploaded certifications (general)
  bisApproval?: string[]; // S3 uploaded BIS Approval documents
  isoCertificate?: string[]; // S3 uploaded ISO Certificate documents
}

const DIMMING_OPTIONS = ['None', 'DALI', '0-10V Dimming', '1-10V Dimming', 'TRIAC', 'Non Dimmable', 'DMX Controlled'];
const ACCESSORIES_OPTIONS = ['None', 'Spike', 'Honeycomb Louvre', 'Tree Strap', 'Spread Lens', 'Cowl'];
const FINISH_OPTIONS = ['None', 'White', 'Black', 'Silver', 'Gold'];
const REFLECTOR_FINISH_OPTIONS = ['None', 'Chrome', 'White', 'Black', 'Silver', 'Gold', 'Dark Chrome'];

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState<string>("");
  const [ipRatings, setIpRatings] = useState<IpRatingPrice[]>([]);
  const [newIpRating, setNewIpRating] = useState<string>("");
  const [newIpPrice, setNewIpPrice] = useState<string>("");
  
  const [dimmingCustom, setDimmingCustom] = useState(false);
  const [accessoriesCustom, setAccessoriesCustom] = useState(false);
  const [finishCustom, setFinishCustom] = useState(false);
  const [reflectorFinishCustom, setReflectorFinishCustom] = useState(false);
  // Auto-update application when IP ratings change
  useEffect(() => {
    if (showModal && ipRatings.length > 0) {
      const autoApplication = getApplicationFromIpRatings(ipRatings);
      setFormData(prev => ({ ...prev, application: autoApplication }));
    }
  }, [ipRatings, showModal]);
  
  // File upload states
  const [productImages, setProductImages] = useState<string[]>([]);
  const [datasheets, setDatasheets] = useState<string[]>([]);
  const [iesFiles, setIesFiles] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [bisApproval, setBisApproval] = useState<string[]>([]);
  const [isoCertificate, setIsoCertificate] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Pagination and search states
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [newVariant, setNewVariant] = useState({ watt: '', lumen: '', dimension: '' });
  
  // Inline editing states
  const [editingPrice, setEditingPrice] = useState<{productId: string, ipIndex: number} | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState<boolean>(false);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    
    if (status === "authenticated") {
      if (session?.user?.role !== "admin") {
        router.push("/products");
        return;
      }
      fetchProducts();
    }
  }, [status, session?.user?.role]);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Memoized unique categories from existing products
  const uniqueCategories = useMemo(() => {
    const categories = products
      .map(p => p.categoryFilter)
      .filter((cat): cat is string => !!cat && cat.trim() !== '');
    return Array.from(new Set(categories)).sort();
  }, [products]);


  // Memoized unique beam angles from existing products
  const uniqueBeamAngles = useMemo(() => {
    const angles = products
      .map(p => p.beamAngle)
      .filter((a): a is string => !!a && a.trim() !== '');
    return Array.from(new Set(angles)).sort();
  }, [products]);

  // Memoized unique CCTs from existing products
  const uniqueCCTs = useMemo(() => {
    const ccts = products
      .map(p => p.cct)
      .filter((a): a is string => !!a && a.trim() !== '');
    return Array.from(new Set(ccts)).sort();
  }, [products]);

  // Memoized unique applications from existing products
  const uniqueApplications = useMemo(() => {
    const applications = products
      .map(p => p.application)
      .filter((app): app is string => !!app && app.trim() !== '');
    return Array.from(new Set(applications)).sort();
  }, [products]);

  // Memoized unique full category names from existing products
  const uniqueFullCategories = useMemo(() => {
    const fullCategories = products
      .map(p => p.category)
      .filter((cat): cat is string => !!cat && cat.trim() !== '');
    return Array.from(new Set(fullCategories)).sort();
  }, [products]);

  // Filtered and paginated products - search across all specifications
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(p => {
      // Search in basic fields
      if (p.sku?.toLowerCase().includes(term)) return true;
      if (p.category?.toLowerCase().includes(term)) return true;
      if (p.categoryFilter?.toLowerCase().includes(term)) return true;
      if (p.application?.toLowerCase().includes(term)) return true;
      
      // Search in specifications

      if (p.watt?.toString().includes(term)) return true;
      if (p.lumen?.toLowerCase().includes(term)) return true;
      if (p.beamAngle?.toLowerCase().includes(term)) return true;
      if (p.dimension?.toLowerCase().includes(term)) return true;
      
      // Search in IP ratings (both old and new format)
      if (p.ipRating?.some(ip => ip.toLowerCase().includes(term))) return true;
      if (p.ipRatings?.some(ip => ip.rating.toLowerCase().includes(term))) return true;
      
      // Search in price
      if (p.price?.toString().includes(term)) return true;
      if (p.ipRatings?.some(ip => ip.price.toString().includes(term))) return true;
      
      return false;
    });
  }, [products, searchTerm]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / itemsPerPage);
  }, [filteredProducts.length, itemsPerPage]);

  const isValidUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const isLikelyImageUrl = (value: string) => {
    // Basic heuristic: ends with common image extensions (ignores query params)
    try {
      const u = new URL(value);
      const pathname = u.pathname.toLowerCase();
      const hostname = u.hostname.toLowerCase();
      
      // Check for direct image extensions
      if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg)$/.test(pathname)) {
        return true;
      }
      
      // Google Drive thumbnail URLs are valid direct image URLs
      if (hostname === "drive.google.com" && pathname.includes("/thumbnail")) {
        return true;
      }
      
      // Google User Content CDN
      if (hostname.includes("googleusercontent.com")) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  };

  const handleAddImage = async () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setError("Please enter a valid image URL (http/https)");
      return;
    }

    // If not a likely direct image link, try to resolve via API (og:image)
    if (!isLikelyImageUrl(trimmed)) {
      try {
        const res = await fetch("/api/resolve-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();
        if (res.ok && data.url && isValidUrl(data.url)) {
          setImages((prev) => [...prev, data.url]);
          setNewImageUrl("");
          return;
        } else {
          setError(data.error || "Could not resolve a direct image URL from the provided link");
          return;
        }
      } catch (e) {
        setError("Failed to resolve image URL. Please paste a direct image link ending with .jpg/.png/etc.");
        return;
      }
    }

    setImages((prev) => [...prev, trimmed]);
    setNewImageUrl("");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddIpRating = async () => {
    let trimmed = newIpRating.trim().toUpperCase();
    const priceValue = parseFloat(newIpPrice);
    
    if (!trimmed) {
      setError("Please enter an IP rating");
      return;
    }
    
    // Auto-prefix with "IP" if user enters just numbers (e.g., "40" becomes "IP40")
    if (/^\d{2}$/.test(trimmed)) {
      trimmed = `IP${trimmed}`;
    }
    
    // Validate IP rating format (e.g., IP20, IP30, IP40, IP65, etc.)
    if (!/^IP\d{2}$/.test(trimmed)) {
      setError("Please enter a valid IP rating (e.g., IP20, IP65, or just 20, 65)");
      return;
    }
    
    // Check if IP rating already exists
    const existingIndex = ipRatings.findIndex(ip => ip.rating === trimmed);
    if (existingIndex !== -1) {
      // Update existing IP rating price instead of blocking
      const priceMsg = newIpPrice && !isNaN(priceValue) && priceValue > 0 
        ? `₹${priceValue} INR` 
        : "TBD (no price)";
      if (confirm(`IP rating ${trimmed} already exists. Do you want to update the price to ${priceMsg}?`)) {
        // Store price directly in INR (no conversion)
        const finalPrice = (newIpPrice && !isNaN(priceValue) && priceValue > 0) 
          ? Math.round(priceValue * 100) / 100 
          : 0;
        const updatedRatings = [...ipRatings];
        updatedRatings[existingIndex].price = finalPrice;
        setIpRatings(updatedRatings);
        setNewIpRating("");
        setNewIpPrice("");
        setError("");
      }
      return;
    }
    
    // Store price directly in INR (no conversion) - rounded to 2 decimal places
    const finalPrice = (newIpPrice && !isNaN(priceValue) && priceValue > 0) 
      ? Math.round(priceValue * 100) / 100 
      : 0;
    
    setIpRatings((prev) => [...prev, { rating: trimmed, price: finalPrice }]);
    setNewIpRating("");
    setNewIpPrice("");
    setError("");
  };

  const handleRemoveIpRating = (index: number) => {
    setIpRatings((prev) => prev.filter((_, i) => i !== index));
  };


  const handleOpenModal = async (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        ...product,
        wattageVariants: product.wattageVariants || []
      });
      setImages(product.images || []);
      setProductImages(product.productImages || []);
      setDatasheets(product.datasheets || []);
      setIesFiles(product.iesFiles || []);
      setCertifications(product.certifications || []);
      setBisApproval(product.bisApproval || []);
      setIsoCertificate(product.isoCertificate || []);
      
      // Prices are stored in INR - no conversion needed
      if (product.ipRatings && product.ipRatings.length > 0) {
        setIpRatings(product.ipRatings);
      } else if (product.ipRating && product.ipRating.length > 0) {
        // Convert old format to new format (legacy data)
        setIpRatings(product.ipRating.map(rating => ({ rating, price: product.price })));
      } else {
        setIpRatings([]);
      }

      setDimmingCustom(product.dimming ? !DIMMING_OPTIONS.includes(product.dimming) : false);
      setAccessoriesCustom(product.accessories ? !ACCESSORIES_OPTIONS.includes(product.accessories) : false);
      setFinishCustom(product.finish ? !FINISH_OPTIONS.includes(product.finish) : false);
      setReflectorFinishCustom(product.reflectorFinish ? !REFLECTOR_FINISH_OPTIONS.includes(product.reflectorFinish) : false);
    } else {
      setEditingProduct(null);
      setFormData({ wattageVariants: [] });
      setImages([]);
      setProductImages([]);
      setDatasheets([]);
      setIesFiles([]);
      setCertifications([]);
      setBisApproval([]);
      setIsoCertificate([]);
      setIpRatings([]);
      setDimmingCustom(false);
      setAccessoriesCustom(false);
      setFinishCustom(false);
      setReflectorFinishCustom(false);
    }
    setShowModal(true);
    setError("");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({});
    setNewVariant({ watt: '', lumen: '', dimension: '' });
    setError("");
    setImages([]);
    setNewImageUrl("");
    setIpRatings([]);
    setNewIpRating("");
    setNewIpPrice("");
    setDimmingCustom(false);
    setAccessoriesCustom(false);
    setFinishCustom(false);
    setReflectorFinishCustom(false);

    setProductImages([]);
    setDatasheets([]);
    setIesFiles([]);
    setCertifications([]);
    setBisApproval([]);
    setIsoCertificate([]);
    setUploadingFile(false);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Form validation
    if (!formData.sku?.trim()) {
      setError("SKU/Model Number is required");
      setSubmitting(false);
      return;
    }

    if (!formData.categoryFilter?.trim()) {
      setError("Category Filter is required");
      setSubmitting(false);
      return;
    }

    if (ipRatings.length === 0) {
      setError("Please add at least one IP rating");
      setSubmitting(false);
      return;
    }

    try {
      const url = editingProduct
        ? `/api/products?id=${editingProduct._id}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          wattageVariants: formData.wattageVariants || [],
          images: images,
          ipRatings: ipRatings,
          productImages: productImages,
          datasheets: datasheets,
          iesFiles: iesFiles,
          certifications: certifications,
          bisApproval: bisApproval,
          isoCertificate: isoCertificate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Operation failed");
        setSubmitting(false);
        return;
      }

      // Optimistic UI update
      if (editingProduct) {
        setProducts(prev => prev.map(p => p._id === editingProduct._id ? data : p));
      } else {
        setProducts(prev => [...prev, data]);
      }

      showToast(editingProduct ? "Product updated successfully" : "Product created successfully", "success");
      handleCloseModal();
    } catch (err) {
      setError("An error occurred");
    } finally {
      setSubmitting(false);
    }
  }, [formData, images, ipRatings, productImages, datasheets, iesFiles, certifications, bisApproval, isoCertificate, editingProduct]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      // Optimistic UI update
      setProducts(prev => prev.filter(p => p._id !== id));

      const response = await fetch(`/api/products?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Revert on error
        fetchProducts();
        const data = await response.json();
        showToast(data.error || "Failed to delete product", "error");
      }
    } catch (err) {
      // Revert on error
      fetchProducts();
      showToast("An error occurred while deleting", "error");
    }
  }, [showToast]);

  // Inline price editing handlers
  const handleStartInlineEdit = (productId: string, ipIndex: number, currentPriceInINR: number) => {
    // Prices are stored in INR - no conversion needed
    setEditingPrice({ productId, ipIndex });
    setEditPriceValue(currentPriceInINR.toString());
  };

  const handleSaveInlinePrice = async (productId: string, ipIndex: number, currentIpRatings: IpRatingPrice[]) => {
    const newPriceINR = parseFloat(editPriceValue);
    
    if (isNaN(newPriceINR) || newPriceINR < 0) {
      showToast("Please enter a valid price (0 or greater)", "error");
      return;
    }

    setSavingPrice(true);

    try {
      // Store price directly in INR (no conversion) - rounded to 2 decimal places
      const finalPrice = Math.round(newPriceINR * 100) / 100;

      // Update the IP rating price
      const updatedIpRatings = [...currentIpRatings];
      updatedIpRatings[ipIndex].price = finalPrice;

      // Save to database
      const updateResponse = await fetch(`/api/products?id=${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipRatings: updatedIpRatings,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        showToast(errorData.error || "Failed to update price", "error");
        setSavingPrice(false);
        return;
      }

      // Update local state
      setProducts(prev => prev.map(p => 
        p._id === productId 
          ? { ...p, ipRatings: updatedIpRatings }
          : p
      ));

      // Clear editing state
      setEditingPrice(null);
      setEditPriceValue("");
      setSavingPrice(false);
    } catch (err) {
      console.error('Error updating price:', err);
      showToast('An error occurred while updating the price', 'error');
      setSavingPrice(false);
    }
  };

  // File upload handlers
  const handleFileUpload = async (
    file: File,
    fileType: "image" | "datasheet" | "ies" | "certification" | "bisApproval" | "isoCertificate"
  ) => {
    setUploadingFile(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to upload file");
        return;
      }

      // Add the uploaded file URL to the appropriate state
      switch (fileType) {
        case "image":
          setProductImages((prev) => [...prev, data.url]);
          break;
        case "datasheet":
          setDatasheets((prev) => [...prev, data.url]);
          break;
        case "ies":
          setIesFiles((prev) => [...prev, data.url]);
          break;
        case "certification":
          setCertifications((prev) => [...prev, data.url]);
          break;
        case "bisApproval":
          setBisApproval((prev) => [...prev, data.url]);
          break;
        case "isoCertificate":
          setIsoCertificate((prev) => [...prev, data.url]);
          break;
      }
    } catch (err) {
      setError("An error occurred while uploading the file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = (
    fileUrl: string,
    fileType: "image" | "datasheet" | "ies" | "certification" | "bisApproval" | "isoCertificate"
  ) => {
    switch (fileType) {
      case "image":
        setProductImages((prev) => prev.filter((url) => url !== fileUrl));
        break;
      case "datasheet":
        setDatasheets((prev) => prev.filter((url) => url !== fileUrl));
        break;
      case "ies":
        setIesFiles((prev) => prev.filter((url) => url !== fileUrl));
        break;
      case "certification":
        setCertifications((prev) => prev.filter((url) => url !== fileUrl));
        break;
      case "bisApproval":
        setBisApproval((prev) => prev.filter((url) => url !== fileUrl));
        break;
      case "isoCertificate":
        setIsoCertificate((prev) => prev.filter((url) => url !== fileUrl));
        break;
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Redirecting to login...</div>
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700 mb-2">You don't have admin privileges.</p>
          <p className="text-sm text-gray-500 mb-4">
            Current role: {session?.user?.role || "none"}
          </p>
          <button
            onClick={() => router.push("/products")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Products
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage products ({filteredProducts.length} total)</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (confirm('Update all products\' applications based on their IP ratings? This will overwrite existing application values.')) {
                  try {
                    const response = await fetch('/api/products/update-applications', { method: 'POST' });
                    const data = await response.json();
                    if (data.success) {
                      alert(`Success! Updated ${data.updatedCount} products, skipped ${data.skippedCount} products.`);
                      fetchProducts(); // Refresh the list
                    } else {
                      alert('Failed to update applications');
                    }
                  } catch (error) {
                    alert('Error updating applications');
                  }
                }
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Zap size={20} />
              Auto-Update Applications
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Add Product
            </button>
            {session?.user?.email === "admin@qlite.com" && (
              <a
                href="/admin/users"
                className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 flex items-center gap-2"
              >
                Manage Users
              </a>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by SKU, category, wattage, lumen, IP rating, price, or any specification..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            />
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-gray-600">
              Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Watt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Ratings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Price (INR)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">{product.category}</span>
                        <span className="text-xs text-blue-600 mt-0.5">
                          🔍 Filter: {product.categoryFilter || 'Not Set'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {(product.productImages && product.productImages.length > 0) || (product.images && product.images.length > 0) ? (
                        <div className="flex items-center justify-center gap-1">
                          <ImageIcon size={16} className="text-green-600" />
                          <span className="text-xs font-medium text-green-600">
                            {(product.productImages?.length || 0) + (product.images?.length || 0)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <ImageIcon size={16} className="text-gray-300" />
                          <span className="text-xs text-gray-400">No</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.watt}W
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {product.ipRatings && product.ipRatings.length > 0 ? (
                          product.ipRatings.map((ip, idx) => (
                            <div key={idx} className="flex flex-col bg-blue-50 border border-blue-200 rounded px-2 py-1 group relative">
                              <span className="text-xs font-semibold text-blue-800">{ip.rating}</span>
                              {editingPrice?.productId === product._id && editingPrice?.ipIndex === idx ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-blue-600">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editPriceValue}
                                    onChange={(e) => setEditPriceValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveInlinePrice(product._id, idx, product.ipRatings!);
                                      } else if (e.key === 'Escape') {
                                        setEditingPrice(null);
                                        setEditPriceValue("");
                                      }
                                    }}
                                    className="w-16 px-1 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                    disabled={savingPrice}
                                  />
                                  <button
                                    onClick={() => handleSaveInlinePrice(product._id, idx, product.ipRatings!)}
                                    disabled={savingPrice}
                                    className="text-green-600 hover:text-green-700 disabled:opacity-50"
                                    title="Save (Enter)"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPrice(null);
                                      setEditPriceValue("");
                                    }}
                                    disabled={savingPrice}
                                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                    title="Cancel (Esc)"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartInlineEdit(product._id, idx, ip.price)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                  title="Click to edit price in INR"
                                >
                                  {ip.price > 0 ? `₹${ip.price.toFixed(2)}` : 'TBD'}
                                </button>
                              )}
                            </div>
                          ))
                        ) : product.ipRating && product.ipRating.length > 0 ? (
                          product.ipRating.map((rating, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded"
                              title="Old format - please edit to add prices"
                            >
                              {rating}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.ipRatings && product.ipRatings.length > 0 ? (
                        <span className="text-gray-400" title="Price varies by IP rating">Varies</span>
                      ) : (
                        <span>₹{product.price.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1 ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1 ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU / Model Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku || ""}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category (Full Name) *
                    </label>
                    <input
                      type="text"
                      required
                      list="full-category-suggestions"
                      value={formData.category || ""}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      placeholder="Select existing or type new (e.g., Surface Mounted Projector Light)"
                    />
                    <datalist id="full-category-suggestions">
                      {uniqueFullCategories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-500">
                      💡 Select from existing full category names or type a new one. Existing: {uniqueFullCategories.length > 0 ? uniqueFullCategories.slice(0, 3).join(', ') + (uniqueFullCategories.length > 3 ? '...' : '') : 'None yet'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category Filter *
                    </label>
                    <input
                      type="text"
                      required
                      list="category-suggestions"
                      value={formData.categoryFilter || ""}
                      onChange={(e) => setFormData({ ...formData, categoryFilter: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      placeholder="Select existing or type new category"
                    />
                    <datalist id="category-suggestions">
                      {uniqueCategories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-500">
                      💡 Select from existing categories or type a new one. Existing: {uniqueCategories.length > 0 ? uniqueCategories.join(', ') : 'None yet'}
                    </p>
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application (Auto-determined from IP Rating)
                    </label>
                    <input
                      type="text"
                      value={formData.application || "Indoor"}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      placeholder="Automatically set based on IP rating"
                    />
                    <p className="mt-1 text-xs text-blue-600">
                      🤖 Auto-set: IP20-44=Indoor | IP45-54=Indoor/Outdoor | IP55-69=Outdoor
                    </p>
                  </div>



                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Watt
                    </label>
                    <input
                      type="number"
                      value={formData.watt || ""}
                      onChange={(e) => setFormData({ ...formData, watt: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lumen
                    </label>
                    <input
                      type="text"
                      value={formData.lumen || ""}
                      onChange={(e) => setFormData({ ...formData, lumen: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      placeholder="e.g., 400lm or 400lm/800lm/1200lm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      💡 For multiple lumen options, separate with / or comma (e.g., 400lm/800lm or 400lm, 800lm)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beam Angle
                    </label>
                    <input
                      type="text"
                      list="beamangle-suggestions"
                      value={formData.beamAngle || ""}
                      onChange={(e) => setFormData({ ...formData, beamAngle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      placeholder="Select existing or type new (e.g., 120°, 60°)"
                    />
                    <datalist id="beamangle-suggestions">
                      {uniqueBeamAngles.map((angle) => (
                        <option key={angle} value={angle} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-500">
                      💡 Select from existing beam angles or type a new one. Existing: {uniqueBeamAngles.length > 0 ? uniqueBeamAngles.join(', ') : 'None yet'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dimension</label>
                    <input 
                      type="text"
                      value={formData.dimension || ''}
                      onChange={(e) => setFormData({...formData, dimension: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div className="col-span-2 border border-gray-200 rounded-lg p-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Wattage Variants (Watt + Lumen + Dimension)
                    </h3>
                    
                    {/* Add new variant row */}
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Watt (e.g. 5)"
                        value={newVariant.watt}
                        onChange={(e) => setNewVariant({...newVariant, watt: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Lumen (e.g. 400lm)"
                        value={newVariant.lumen}
                        onChange={(e) => setNewVariant({...newVariant, lumen: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Dimension (e.g. Ø63x63mm)"
                        value={newVariant.dimension}
                        onChange={(e) => setNewVariant({...newVariant, dimension: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newVariant.watt) return;
                          const current = formData.wattageVariants || [];
                          setFormData({
                            ...formData,
                            wattageVariants: [...current, {
                              watt: Number(newVariant.watt),
                              lumen: newVariant.lumen,
                              dimension: newVariant.dimension
                            }]
                          });
                          setNewVariant({ watt: '', lumen: '', dimension: '' });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Variants list */}
                    {(formData.wattageVariants || []).length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 px-2">
                          <span>Watt</span>
                          <span>Lumen</span>
                          <span>Dimension</span>
                          <span></span>
                        </div>
                        {(formData.wattageVariants || []).map((v: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-4 gap-2 items-center bg-gray-50 rounded-lg px-2 py-2">
                            <span className="text-sm text-gray-700">{v.watt}W</span>
                            <span className="text-sm text-gray-700">{v.lumen || '-'}</span>
                            <span className="text-sm text-gray-700">{v.dimension || '-'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (formData.wattageVariants || []).filter((_: any, i: number) => i !== idx);
                                setFormData({...formData, wattageVariants: updated});
                              }}
                              className="text-red-500 hover:text-red-700 text-xs cursor-pointer justify-self-end"
                            >
                              ✕ Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {(formData.wattageVariants || []).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        No variants added yet. Add watt + lumen + dimension combinations above.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CCT</label>
                    <input 
                      type="text"
                      list="cct-suggestions"
                      value={formData.cct || ''}
                      onChange={(e) => setFormData({...formData, cct: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      placeholder="Select existing or type new (e.g., 3000K, 4000K)"
                    />
                    <datalist id="cct-suggestions">
                      {uniqueCCTs.map((cct) => (
                        <option key={cct} value={cct} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-500">
                      💡 Select from existing CCTs or type a new one. Existing: {uniqueCCTs.length > 0 ? uniqueCCTs.join(', ') : 'None yet'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dimming</label>
                    <select
                      value={dimmingCustom ? 'Custom' : (formData.dimming || 'None')}
                      onChange={(e) => {
                        if (e.target.value === 'Custom') {
                          setDimmingCustom(true);
                          setFormData({...formData, dimming: ''});
                        } else {
                          setDimmingCustom(false);
                          setFormData({...formData, dimming: e.target.value === 'None' ? '' : e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {DIMMING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      <option value="Custom">Custom...</option>
                    </select>
                    {dimmingCustom && (
                      <input
                        type="text"
                        placeholder="Enter custom dimming value"
                        value={formData.dimming || ''}
                        onChange={(e) => setFormData({...formData, dimming: e.target.value})}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accessories</label>
                    <select
                      value={accessoriesCustom ? 'Custom' : (formData.accessories || 'None')}
                      onChange={(e) => {
                        if (e.target.value === 'Custom') {
                          setAccessoriesCustom(true);
                          setFormData({...formData, accessories: ''});
                        } else {
                          setAccessoriesCustom(false);
                          setFormData({...formData, accessories: e.target.value === 'None' ? '' : e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {ACCESSORIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      <option value="Custom">Custom...</option>
                    </select>
                    {accessoriesCustom && (
                      <input
                        type="text"
                        placeholder="Enter custom accessories value"
                        value={formData.accessories || ''}
                        onChange={(e) => setFormData({...formData, accessories: e.target.value})}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                    <select
                      value={finishCustom ? 'Custom' : (formData.finish || 'None')}
                      onChange={(e) => {
                        if (e.target.value === 'Custom') {
                          setFinishCustom(true);
                          setFormData({...formData, finish: ''});
                        } else {
                          setFinishCustom(false);
                          setFormData({...formData, finish: e.target.value === 'None' ? '' : e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {FINISH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      <option value="Custom">Custom...</option>
                    </select>
                    {finishCustom && (
                      <input
                        type="text"
                        placeholder="Enter custom finish value"
                        value={formData.finish || ''}
                        onChange={(e) => setFormData({...formData, finish: e.target.value})}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reflector Finish</label>
                    <select
                      value={reflectorFinishCustom ? 'Custom' : (formData.reflectorFinish || 'None')}
                      onChange={(e) => {
                        if (e.target.value === 'Custom') {
                          setReflectorFinishCustom(true);
                          setFormData({...formData, reflectorFinish: ''});
                        } else {
                          setReflectorFinishCustom(false);
                          setFormData({...formData, reflectorFinish: e.target.value === 'None' ? '' : e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      {REFLECTOR_FINISH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      <option value="Custom">Custom...</option>
                    </select>
                    {reflectorFinishCustom && (
                      <input
                        type="text"
                        placeholder="Enter custom reflector finish value"
                        value={formData.reflectorFinish || ''}
                        onChange={(e) => setFormData({...formData, reflectorFinish: e.target.value})}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Images (URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/image.jpg or Google Drive link"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddImage}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports direct image URLs, ImgBB (i.ibb.co), and Google Drive links (must be publicly shared). 
                      <br />
                      <span className="text-blue-600">Tip: For best results, use ImgBB.com - upload your image and copy the "Direct link".</span>
                    </p>

                    {images.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {images.map((img, idx) => (
                          <li
                            key={`${img}-${idx}`}
                            className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded p-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-14 h-14 bg-white border rounded overflow-hidden flex items-center justify-center">
                                {/* Thumbnail preview; if it fails to load, it will show as broken */}
                                <img
                                  src={img}
                                  alt={`Image ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // fallback to a simple placeholder if load fails
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {!isLikelyImageUrl(img) && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 whitespace-nowrap">Not a direct image URL</span>
                                  )}
                                  <a
                                    href={img}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-blue-600 hover:underline truncate block max-w-[480px]"
                                    title={img}
                                  >
                                    {img}
                                  </a>
                                </div>
                                {!isLikelyImageUrl(img) && (
                                  <p className="text-xs text-gray-500 mt-1">Tip: Use a direct image link ending with .jpg, .png, etc. For ImgBB use i.ibb.co/... links.</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="text-red-600 hover:text-red-700 text-sm shrink-0"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IP Ratings with Prices (INR)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., IP20, IP65 or just 20, 65"
                        value={newIpRating}
                        onChange={(e) => setNewIpRating(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIpRating();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price (INR) - Optional"
                        value={newIpPrice}
                        onChange={(e) => setNewIpPrice(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIpRating();
                          }
                        }}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddIpRating}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter IP rating (e.g., IP20 or just 20) with price in INR. "IP" prefix is added automatically if you enter just numbers.
                    </p>

                    {ipRatings.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ipRatings.map((ip, idx) => (
                          <div
                            key={`${ip.rating}-${idx}`}
                            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-blue-900">{ip.rating}</span>
                              <span className="text-xs text-blue-700">{ip.price > 0 ? `₹${ip.price.toFixed(2)}` : 'TBD'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveIpRating(idx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>



                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Price (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price || ""}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                      disabled={ipRatings.length > 0}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {ipRatings.length > 0 
                        ? "Price is set per IP rating above" 
                        : "Base price in INR (optional if using IP ratings)"}
                    </p>
                  </div>

                  {/* File Upload Sections */}
                  <div className="col-span-2 border-t pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">File Attachments (AWS S3)</h3>
                    
                    {/* Product Images Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={16} />
                        Product Images
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "image");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload product images (JPG, PNG, WebP, GIF - Max 10MB)
                      </p>
                      {productImages.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {productImages.map((url, idx) => (
                            <div key={idx} className="relative group border rounded-lg p-2 bg-gray-50">
                              <img src={url} alt={`Product ${idx + 1}`} className="w-full h-24 object-cover rounded" />
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "image")}
                                className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block mt-1">
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Datasheets Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <FileText size={16} />
                        Datasheets
                      </label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "datasheet");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload product datasheets (PDF - Max 10MB)
                      </p>
                      {datasheets.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {datasheets.map((url, idx) => (
                            <li key={idx} className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                                Datasheet {idx + 1}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "datasheet")}
                                className="text-red-600 hover:text-red-700 ml-2"
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* IES Files Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Zap size={16} />
                        IES Files
                      </label>
                      <input
                        type="file"
                        accept=".ies,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "ies");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload IES lighting files (.ies, .txt - Max 10MB)
                      </p>
                      {iesFiles.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {iesFiles.map((url, idx) => (
                            <li key={idx} className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                                IES File {idx + 1}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "ies")}
                                className="text-red-600 hover:text-red-700 ml-2"
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Certifications Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Award size={16} />
                        Certifications
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "certification");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload certifications (PDF, JPG, PNG - Max 10MB)
                      </p>
                      {certifications.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {certifications.map((url, idx) => (
                            <li key={idx} className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                                Certification {idx + 1}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "certification")}
                                className="text-red-600 hover:text-red-700 ml-2"
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* BIS Approval Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Award size={16} />
                        BIS Approval
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "bisApproval");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload BIS Approval documents (PDF, JPG, PNG - Max 10MB)
                      </p>
                      {bisApproval.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {bisApproval.map((url, idx) => (
                            <li key={idx} className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                                BIS Approval {idx + 1}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "bisApproval")}
                                className="text-red-600 hover:text-red-700 ml-2"
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* ISO Certificate Upload */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Award size={16} />
                        ISO Certificate
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "isoCertificate");
                          e.target.value = "";
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        disabled={uploadingFile}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload ISO Certificate documents (PDF, JPG, PNG - Max 10MB)
                      </p>
                      {isoCertificate.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {isoCertificate.map((url, idx) => (
                            <li key={idx} className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                                ISO Certificate {idx + 1}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(url, "isoCertificate")}
                                className="text-red-600 hover:text-red-700 ml-2"
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {uploadingFile && (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-gray-600 mt-2">Uploading file...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 border-t pt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
                    <select
                      value={formData.territory || 'Middle East'}
                      onChange={(e) => setFormData({
                        ...formData, territory: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="Middle East">Middle East</option>
                      <option value="India">India</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingFile}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      submitting || uploadingFile
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {editingProduct ? "Updating..." : "Creating..."}
                      </>
                    ) : uploadingFile ? (
                      <>
                        <Upload size={16} className="animate-pulse" />
                        Uploading files...
                      </>
                    ) : (
                      <>{editingProduct ? "Update Product" : "Create Product"}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}