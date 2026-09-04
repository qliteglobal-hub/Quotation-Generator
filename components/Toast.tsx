'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useSession } from 'next-auth/react';
import CurrencySelector from './CurrencySelector';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ShoppingCart, Trash2, Plus, Minus, FileText, FileSpreadsheet, 
  Package, ArrowLeft, AlertCircle, CheckCircle2, X, Mail, Phone, Briefcase, MapPin, Zap, Search, Settings
} from 'lucide-react';
import Link from 'next/link';

interface Product {
  _id: string;
  sku?: string;
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
  isDriver?: boolean;
  parentProductId?: string;
  // Driver-specific fields
  wattageRange?: { min: number; max: number };
  outputVoltage?: string;
  outputCurrent?: string;
  type?: string;
  series?: string;
};

export default function EnhancedCart() {
  const { cart, removeFromCart, clearCart, increaseQuantity, decreaseQuantity, updateQuantity, addDriverToCart } = useCart() as {
    cart: CartItem[];
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    increaseQuantity: (id: string) => void;
    decreaseQuantity: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    addDriverToCart: (driver: Driver, parentProductId: string, quantity?: number) => void;
  };
  const { formatPrice, convertPrice, currencyInfo } = useCurrency();
  const { data: session } = useSession();
  
  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin';

  const [userInfo, setUserInfo] = useState({ email: '', mobile: '', project: '', company: '', subject: '', invoiceNo: '' });
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<'bahrain' | 'uae' | 'bangalore' | 'delhi'>('bahrain');
  const [discount, setDiscount] = useState(0); // Discount percentage (0-15%)
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedProductForDriver, setSelectedProductForDriver] = useState<CartItem | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  
  // Driver search state
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  
  // Terms and Conditions state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState({
    deliveryLocation: 'DDP Bahrain',
    deliveryTime: '8-10 Weeks',
    paymentTerms: '50% advance and balance 50% on delivery',
    productMake: 'Qlite UK make',
    validityDays: '45 days',
    vatNote: 'VAT will charged as per applicable government regulations',
    salesPersonName: ''
  });

  // Calculate total in selected currency (not base INR price)
  const subtotal = cart.reduce((sum, item) => {
    const convertedPrice = convertPrice(item.price ?? 0);
    return sum + (convertedPrice * (item.quantity ?? 1));
  }, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;
  const canDownload = userInfo.email && userInfo.mobile && userInfo.project;
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setShowError(false);
  };

  // Update delivery location when address changes
  useEffect(() => {
    updateDeliveryLocation(selectedAddress);
  }, [selectedAddress]);

  // Fetch all available drivers for a product
  const fetchDriversForProduct = async (product: CartItem) => {
    setLoadingDrivers(true);
    setSelectedProductForDriver(product);
    setShowDriverModal(true);
    
    // Reset search when opening modal
    setDriverSearchTerm('');
    
    try {
      // Fetch all in-stock drivers without filtering by wattage
      const response = await fetch(`/api/drivers`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      
      const drivers = await response.json();
      setAvailableDrivers(drivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setAvailableDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleAddDriver = (driver: Driver) => {
    if (selectedProductForDriver) {
      addDriverToCart(driver, selectedProductForDriver.cartItemId, 1);
      setShowDriverModal(false);
      // Reset search when closing
      setDriverSearchTerm('');
    }
  };
  
  const handleCloseDriverModal = () => {
    setShowDriverModal(false);
    // Reset search when closing
    setDriverSearchTerm('');
  };

  // Helper function to extract numeric IP rating from string (e.g., "IP67" -> 67)
  const getNumericIPRating = (ipRating: string | undefined): number => {
    if (!ipRating) return 0;
    const match = ipRating.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Filter and categorize drivers by IP rating with search
  const categorizeDrivers = () => {
    let filtered = [...availableDrivers];
    
    // Apply search filter
    if (driverSearchTerm.trim()) {
      const searchLower = driverSearchTerm.toLowerCase();
      filtered = filtered.filter(driver => 
        driver.name?.toLowerCase().includes(searchLower) ||
        driver.sku?.toLowerCase().includes(searchLower) ||
        driver.series?.toLowerCase().includes(searchLower) ||
        driver.description?.toLowerCase().includes(searchLower) ||
        driver.outputVoltage?.toLowerCase().includes(searchLower) ||
        driver.type?.toLowerCase().includes(searchLower) ||
        driver.wattageRange && `${driver.wattageRange.min}-${driver.wattageRange.max}w`.includes(searchLower)
      );
    }
    
    // Categorize by IP rating
    const indoor: Driver[] = [];
    const outdoor: Driver[] = [];
    
    filtered.forEach(driver => {
      const ipValue = getNumericIPRating(driver.ipRating);
      if (ipValue <= 64) {
        indoor.push(driver);
      } else {
        outdoor.push(driver);
      }
    });
    
    return { indoor, outdoor };
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
    
    if (item.watt) parts.push(`${item.watt}W`);
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
    // Check if user is logged in
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }
    
    if (!canDownload) { setShowError(true); return; }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cart');
    
    // Get dynamic address based on currency
    const addressInfo = getAddressInfo();
    
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
          tl: { col: 0, row: 0 },
          ext: { width: 120, height: 135 }
        });
      }
    } catch (error) {
      console.error('Error adding logo:', error);
    }

    // Add company address on the right side aligned with table end (column 9)
    let currentRow = 1;
    addressInfo.lines.forEach((line, index) => {
      const row = worksheet.getRow(currentRow);
      row.getCell(9).value = line;
      row.getCell(9).font = { bold: true, size: index === 0 ? 11 : 9 };
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      currentRow++;
    });
    
    // Add contact details, date, and invoice below the address
    const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    // Add a blank row for spacing
    currentRow++;
    
    // Contact No - use column 8 for better alignment
    worksheet.getRow(currentRow).getCell(8).value = `Contact No: ${userInfo.mobile || ''}`;
    worksheet.getRow(currentRow).getCell(8).font = { bold: true, size: 9 };
    worksheet.getRow(currentRow).getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    currentRow++;

     // Invoice No
    worksheet.getRow(currentRow).getCell(8).value = `Invoice No: ${userInfo.invoiceNo || ''}`;
    worksheet.getRow(currentRow).getCell(8).font = { bold: true, size: 9 };
    worksheet.getRow(currentRow).getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    
    // Date
    worksheet.getRow(currentRow).getCell(8).value = `Date: ${currentDate}`;
    worksheet.getRow(currentRow).getCell(8).font = { bold: true, size: 9 };
    worksheet.getRow(currentRow).getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    currentRow++;
    
   

    // Create bordered summary box below logo - Left side only
    const summaryStartRow = addressInfo.lines.length + 2;
    const summaryEndRow = summaryStartRow + 2; // 3 rows for the box
    
    // Left section (columns 1-7): Attn, Company, Subject
    worksheet.getRow(summaryStartRow).getCell(1).value = 'Attn:';
    worksheet.getRow(summaryStartRow).getCell(1).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow).getCell(2).value = userInfo.project || '';
    worksheet.getRow(summaryStartRow).getCell(2).font = { bold: true, size: 10 };
    
    worksheet.getRow(summaryStartRow + 1).getCell(1).value = 'Company:';
    worksheet.getRow(summaryStartRow + 1).getCell(1).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow + 1).getCell(2).value = userInfo.company || '';
    worksheet.getRow(summaryStartRow + 1).getCell(2).font = { bold: true, size: 10 };
    
    worksheet.getRow(summaryStartRow + 2).getCell(1).value = 'Subject:';
    worksheet.getRow(summaryStartRow + 2).getCell(1).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow + 2).getCell(2).value = userInfo.subject || '';
    worksheet.getRow(summaryStartRow + 2).getCell(2).font = { bold: true, size: 10 };
    
    // Set row heights for summary box (no borders)
    for (let row = summaryStartRow; row <= summaryEndRow; row++) {
      worksheet.getRow(row).height = 20;
      // Set alignment for all cells in the row
      for (let col = 1; col <= 7; col++) {
        const cell = worksheet.getRow(row).getCell(col);
        cell.alignment = { vertical: 'middle' };
      }
    }

    const excelCurrency = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.symbol;
    const startRow = addressInfo.lines.length + 6; // Adjusted for new header layout
    
    // Add column headers (optimized for PDF conversion)
    const headerRow = worksheet.getRow(startRow);
    const columns = [
      'SI No','Type','Description','Image','Code','Description',`QTY`,`Unit Rate (${excelCurrency})`,`Total (${excelCurrency})`
    ];
    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0046FF' }
      };
      // Add borders to header cells
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 20;

    // Set column widths
    worksheet.getColumn(1).width = 8;  // SI No
    worksheet.getColumn(2).width = 12; // Type (blank)
    worksheet.getColumn(3).width = 25; // Description (Category)
    worksheet.getColumn(4).width = 15; // Image
    worksheet.getColumn(5).width = 20; // Code (Model Number)
    worksheet.getColumn(6).width = 25; // Description (blank)
    worksheet.getColumn(7).width = 10; // QTY
    worksheet.getColumn(8).width = 15; // Unit Rate
    worksheet.getColumn(9).width = 15; // Total

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
      } catch {}
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
        // Add product
        organizedCartExcel.push(item);
        // Add its drivers right after
        const productDrivers = cart.filter(d => d.isDriver && d.parentProductId === item.cartItemId);
        organizedCartExcel.push(...productDrivers);
      }
    });
    // Add any standalone drivers (without parent)
    const standaloneDriversExcel = cart.filter(item => item.isDriver && !item.parentProductId);
    organizedCartExcel.push(...standaloneDriversExcel);

    // Add data rows with images (including drivers)
    let serialNumber = 1;
    let currentRowIndex = startRow + 1; // Start after header row
    
    for (let i = 0; i < organizedCartExcel.length; i++) {
      const item = organizedCartExcel[i];
      
      if (item.isDriver) {
        // DRIVER: single row with merged specs
        const rowIndex = currentRowIndex;
        const row = worksheet.getRow(rowIndex);
        row.height = 60;
        
        row.getCell(1).value = serialNumber; // SI No
        row.getCell(2).value = item.sku ?? 'N/A'; // Type (Model Number for drivers)
        
        // Build driver specs
        const parts: string[] = [];
        if (item.wattageRange) parts.push(`Power: ${item.wattageRange.min}W`);
        if (item.outputVoltage) parts.push(`Output: ${item.outputVoltage}`);
        if ((item as any).outputCurrent) parts.push(`Current: ${(item as any).outputCurrent}`);

        if ((item as any).ipRating) parts.push(`IP: ${(item as any).ipRating}`);
        if ((item as any).type) parts.push(`Type: ${(item as any).type}`);
        const specText = parts.join(' | ');

        // Merge columns 3-6 for specs
        row.getCell(3).value = specText;
        for (let c = 4; c <= 6; c++) row.getCell(c).value = '';
        worksheet.mergeCells(rowIndex, 3, rowIndex, 6);
        
        row.getCell(7).value = item.quantity ?? 1; // QTY
        row.getCell(8).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Unit Rate
        row.getCell(9).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Total

        // Add borders
        for (let col = 1; col <= 9; col++) {
          const cell = row.getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, size: 9 };
        }
        
        currentRowIndex++;
        serialNumber++;
      } else {
        // LED PRODUCT: Single row with each cell merged vertically across 2 rows
        const row1Index = currentRowIndex;
        const row2Index = row1Index + 1;
        
        const row1 = worksheet.getRow(row1Index);
        const row2 = worksheet.getRow(row2Index);
        row1.height = 50;
        row2.height = 50;
        
        // SI No - merge 2 rows vertically
        row1.getCell(1).value = serialNumber;
        worksheet.mergeCells(row1Index, 1, row2Index, 1);
        
        // Type - merge 2 rows vertically (blank for LED)
        row1.getCell(2).value = '';
        worksheet.mergeCells(row1Index, 2, row2Index, 2);
        
        // Description (Category) - merge 2 rows vertically
        row1.getCell(3).value = item.category ?? '-';
        worksheet.mergeCells(row1Index, 3, row2Index, 3);
        
        // Image - merge 2 rows vertically
        row1.getCell(4).value = '';
        worksheet.mergeCells(row1Index, 4, row2Index, 4);
        
        // Code (Model Number) - merge 2 rows vertically
        row1.getCell(5).value = item.sku ?? 'N/A';
        worksheet.mergeCells(row1Index, 5, row2Index, 5);
        
        // Description (blank) - merge 2 rows vertically
        row1.getCell(6).value = '';
        worksheet.mergeCells(row1Index, 6, row2Index, 6);
        
        // QTY - merge 2 rows vertically
        row1.getCell(7).value = item.quantity ?? 1;
        worksheet.mergeCells(row1Index, 7, row2Index, 7);
        
        // Unit Rate - merge 2 rows vertically
        row1.getCell(8).value = convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        worksheet.mergeCells(row1Index, 8, row2Index, 8);
        
        // Total - merge 2 rows vertically
        row1.getCell(9).value = (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        worksheet.mergeCells(row1Index, 9, row2Index, 9);
        
        // Add borders to all cells in both rows
        for (let r = row1Index; r <= row2Index; r++) {
          for (let col = 1; col <= 9; col++) {
            const cell = worksheet.getRow(r).getCell(col);
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' }
            };
          }
        }
        
        // Add image
        const imageUrl = getPrimaryImageUrl(item);
        if (imageUrl) {
          const imageBuffer = await fetchImageBuffer(imageUrl);
          if (imageBuffer) {
            try {
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: 'jpeg',
              });
              
              worksheet.addImage(imageId, {
                tl: { col: 3, row: row1Index - 1 },
                ext: { width: 70, height: 70 },
                editAs: 'oneCell'
              });
            } catch (error) {
              console.error('Error adding image:', error);
            }
          }
        }
        
        currentRowIndex += 2; // Move by 2 rows for LED products
        serialNumber++;
      }
    }

    // Add empty row for spacing
    const emptyRowIndex = currentRowIndex + 1;
    
    // Add total row (after empty row)
    const totalRowIndex = emptyRowIndex + 1;
    const totalRow = worksheet.getRow(totalRowIndex);
    
    // Merge cells for total label
    worksheet.mergeCells(totalRowIndex, 7, totalRowIndex, 8);
    totalRow.getCell(7).value = `Total Amount (${excelCurrency}):`;
    totalRow.getCell(7).font = { bold: true, size: 14 };
    totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(7).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    
    // Total value
    totalRow.getCell(9).value = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    totalRow.getCell(9).font = { bold: true, size: 14 };
    totalRow.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };
    totalRow.getCell(9).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Add Terms and Conditions
    const termsStartRow = totalRowIndex + 3;
    worksheet.getRow(termsStartRow).getCell(1).value = 'Terms and Conditions:';
    worksheet.getRow(termsStartRow).getCell(1).font = { bold: true, size: 11, underline: true };
    // Merge cells for header
    worksheet.mergeCells(termsStartRow, 1, termsStartRow, 9);
    
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
      // Merge 3 cells for each term line (columns 1-3)
      worksheet.mergeCells(rowNum, 1, rowNum, 3);
      row.height = 25; // Set row height for better readability
    });
    
    // Add closing
    const closingRow = termsStartRow + terms.length + 2;
    worksheet.getRow(closingRow).getCell(1).value = 'Thanking You';
    worksheet.getRow(closingRow).getCell(1).font = { bold: true, size: 10 };
    
    worksheet.getRow(closingRow + 2).getCell(1).value = 'Yours Sincerely';
    worksheet.getRow(closingRow + 2).getCell(1).font = { bold: true, size: 10 };
    
    if (termsAndConditions.salesPersonName) {
      worksheet.getRow(closingRow + 4).getCell(1).value = termsAndConditions.salesPersonName;
      worksheet.getRow(closingRow + 4).getCell(1).font = { bold: true, size: 10 };
    }

    // Set print options
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3
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
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
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

  const exportPDF = async () => {
    // Check if user is logged in
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }
    
    if (!canDownload) { setShowError(true); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginRight = 20;
    const rightX = pageWidth - marginRight;

    doc.addImage('/logo.jpg', 'JPEG', 14, 10, 80, 90);

    // Get dynamic address based on currency
    const addressInfo = getAddressInfo();
    
    // Add company name (first line) - BOLD and LARGER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    let yPosition = 25;
    doc.text(addressInfo.lines[0], rightX, yPosition, { align: 'right' });
    yPosition += 15;
    
    // Add remaining address lines - slightly larger font
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (let i = 1; i < addressInfo.lines.length; i++) {
      doc.text(addressInfo.lines[i], rightX, yPosition, { align: 'right' });
      yPosition += 12;
    }

    // Add two boxes side by side (appearing as one)
    const boxX = 14;
    const boxY = 105;
    const totalWidth = pageWidth - 28;
    const leftBoxWidth = totalWidth / 2;
    const rightBoxWidth = totalWidth / 2;
    const boxHeight = 50;
    const rowHeight = boxHeight / 3; // 3 rows
    
    doc.setLineWidth(1);
    doc.setDrawColor(0, 0, 0);
    
    // Draw outer border
    doc.rect(boxX, boxY, totalWidth, boxHeight);
    
    // Draw vertical line separating left and right sections
    doc.line(boxX + leftBoxWidth, boxY, boxX + leftBoxWidth, boxY + boxHeight);
    
    // Draw horizontal lines for rows (2 lines to create 3 rows)
    doc.line(boxX, boxY + rowHeight, boxX + totalWidth, boxY + rowHeight);
    doc.line(boxX, boxY + (rowHeight * 2), boxX + totalWidth, boxY + (rowHeight * 2));
    
    // Left box content
    const leftX = boxX + 8;
    let leftY = boxY + 12;
    const lineHeight = rowHeight;
    const labelWidth = 50;
    
    doc.setFontSize(9);
    
    // Attn
    doc.setFont('helvetica', 'bold');
    doc.text('Attn:', leftX, leftY);
    doc.setFont('helvetica', 'normal');
    doc.text(userInfo.project || '', leftX + labelWidth, leftY);
    leftY += lineHeight;
    
    // Company
    doc.setFont('helvetica', 'bold');
    doc.text('Company:', leftX, leftY);
    doc.setFont('helvetica', 'normal');
    doc.text(userInfo.company || '', leftX + labelWidth, leftY);
    leftY += lineHeight;
    
    // Subject
    doc.setFont('helvetica', 'bold');
    doc.text('Subject:', leftX, leftY);
    doc.setFont('helvetica', 'normal');
    doc.text(userInfo.subject || '', leftX + labelWidth, leftY);
    
    // Right box content
    const rightColX = boxX + leftBoxWidth + 8;
    let rightY = boxY + 12;
    
    // Contact No
    doc.setFont('helvetica', 'bold');
    doc.text('Contact No:', rightColX, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(userInfo.mobile || '', rightColX + labelWidth, rightY);
    rightY += lineHeight;
    
    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', rightColX, rightY);
    doc.setFont('helvetica', 'normal');
    const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(currentDate, rightColX + labelWidth, rightY);
    rightY += lineHeight;
    
    // Invoice No
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice No:', rightColX, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(userInfo.invoiceNo || '', rightColX + labelWidth, rightY);

    const pdfCurrency = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.symbol;
    const columns = [
      'SI No','Image','Model Number','Category','Application','Input Voltage','Watt','Lumen','Beam Angle','IP Rating',`Price (${pdfCurrency})`,'Quantity',`Total (${pdfCurrency})`
    ];

    const getPrimaryImageUrl = (item: CartItem): string | null => {
      const url = item.productImages?.[0] || item.images?.[0] || null;
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
      } catch {}
      return url;
    };

    const toDataUrl = async (url: string): Promise<string> => {
      const u = await resolveImageUrl(url);
      const res = await fetch(u, { mode: 'cors' });
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
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

    const imageDataUrls = await Promise.all(
      organizedCart.map(async (item) => {
        const url = getPrimaryImageUrl(item);
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
    const rowHeights = await Promise.all(
      imageDataUrls.map(async (du) => {
        if (!du) return 0;
        const h = await getScaledImgHeight(du, targetImgWidth);
        return Math.ceil(h + 4);
      })
    );

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
        
        return [
          index + 1, // SI No
          '', // No image for driver
          `   > ${item.sku ?? 'N/A'}`, // Indented driver SKU
          { content: allSpecs, colSpan: 7, styles: { halign: 'left' as const } }, // Merged cell with all specs
          convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          item.quantity ?? 1,
          (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
      } else {
        // LED Product row - normal format
        return [
          index + 1, // SI No
          '',
          item.sku ?? 'N/A',
          item.category ?? '-',
          item.application ?? '-',
          item.watt ?? '-',
          item.lumen ?? '-',
          item.beamAngle ?? '-',
          item.ipRating && item.ipRating.trim() !== '' ? item.ipRating : 'N/A',
          convertPrice(item.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          item.quantity ?? 1,
          (convertPrice(item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
      }
    });

    const cellPadding = { top: 6, right: 2, bottom: 6, left: 2 } as const;
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 165,
      styles: { 
        fontSize: 8, 
        cellPadding, 
        fontStyle: 'bold', 
        valign: 'middle',
        lineColor: [0, 0, 0], // Black border lines
        lineWidth: 1, // Bold border line thickness
        textColor: [0, 0, 0] // Black text for better visibility
      },
      headStyles: { 
        fillColor: [0, 70, 255], 
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: 8,
        lineColor: [0, 0, 0],
        lineWidth: 1
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14, top: 20 },
      columnStyles: { 
        0: { cellWidth: 15 }, // SI No column
        1: { cellWidth: 50 },  // Image column
        9: { cellWidth: 'auto', minCellWidth: 45 }  // IP Rating column - ensure enough width for text like "IP67 front / IP65 rear"
      },
      theme: 'grid', // Use grid theme to show all borders
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const idx = data.row.index;
          const item = organizedCart[idx];
          
          // For driver rows, use lighter background and smaller height
          if (item?.isDriver) {
            data.cell.styles.fillColor = [250, 250, 250]; // Very light gray
            data.cell.styles.textColor = [0, 0, 0]; // Black text for better visibility
            data.cell.styles.fontSize = 7.5;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.minCellHeight = 30; // Smaller height for drivers
          } else {
            const imgInnerH = (rowHeights[idx] || 46);
            const desired = imgInnerH + cellPadding.top + cellPadding.bottom;
            data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, desired, 52);
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body') {
          const idx = data.row.index;
          const item = organizedCart[idx];
          
          // Render images for product rows (Image column is now index 1)
          if (data.column.index === 1) {
            const item = organizedCart[idx];
            
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
              try { doc.addImage(dataUrl, 'JPEG', x, y, imgW, imgH); } catch {}
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
              } catch {}
            }
          }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 140;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    // Total is already in converted currency, no need to convert again
    const formattedTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const currencyDisplay = currencyInfo.symbol === '₹' ? 'INR' : currencyInfo.symbol;
    doc.text(`Total Amount: ${currencyDisplay} ${formattedTotal}`, rightX, finalY + 20, { align: 'right' });

    // Add Terms and Conditions in a bordered box
    const pageHeight = doc.internal.pageSize.height;
    let termsY = finalY + 40;
    
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
    
    const terms = [
      `1. The prices quoted on ${termsAndConditions.deliveryLocation}.`,
      `2. Delivery: Within ${termsAndConditions.deliveryTime} from the date of PO and advance payment.`,
      `3. Payment Terms: ${termsAndConditions.paymentTerms}.`,
      `4. The quoted products are ${termsAndConditions.productMake}`,
      `5. Validity of offer: ${termsAndConditions.validityDays}`,
      `6. ${termsAndConditions.vatNote}`
    ];
    
    terms.forEach((term) => {
      const lines = doc.splitTextToSize(term, termsBoxWidth - 20);
      doc.text(lines, termsBoxX + 8, termsContentY);
      termsContentY += lines.length * 12;
    });
    
    // Add closing
    termsContentY += 15;
    doc.setFontSize(9);
    doc.text('Thanking You', termsBoxX + 8, termsContentY);
    
    termsContentY += 20;
    doc.text('Yours Sincerely', termsBoxX + 8, termsContentY);
    
    if (termsAndConditions.salesPersonName) {
      termsContentY += 20;
      doc.setFont('helvetica', 'bold');
      doc.text(termsAndConditions.salesPersonName, termsBoxX + 8, termsContentY);
    }
    
    // Draw box around entire terms section
    const termsBoxHeight = termsContentY - termsBoxY + 15;
    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 0, 0); // Blue border
    doc.rect(termsBoxX, termsBoxY, termsBoxWidth, termsBoxHeight);

    doc.save(`${userInfo.project}_quotation.pdf`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-[#001f3f]'}`}>
      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`max-w-md w-full mx-4 rounded-xl shadow-2xl ${
            isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white'
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
                  className={`p-1 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
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
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold text-center transition-colors ${
                    isDarkMode 
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
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
            isDarkMode ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
          }`}>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
              File downloaded successfully!
            </span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link 
                href="/products"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  isDarkMode 
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
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-yellow-400" />
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  My Quotations
                  {cart.length > 0 && (
                    <span className="ml-2 bg-yellow-400 text-black px-2 py-0.5 rounded-full text-xs font-bold">
                      {totalItems}
                    </span>
                  )}
                </h1>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Review and generate quotations
                </p>
              </div>
            </div>
          </div>
        </div>

        {cart.length === 0 ? (
          /* Empty Cart State */
          <div className={`rounded-xl p-8 sm:p-12 text-center ${
            isDarkMode ? 'bg-gray-900/50 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <Package className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              No Products Added Yet
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Start by browsing our products and adding items to create your quotation
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Cart Items - Left Column */}
            <div className="lg:col-span-3">
              {/* Products Count Header */}
              <div className={`mb-3 px-4 py-2 rounded-lg flex items-center justify-between ${
                isDarkMode ? 'bg-gray-900/30 border border-white/5' : 'bg-gray-50 border border-gray-200'
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
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                    isDarkMode 
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 gap-2">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className={`rounded-lg p-2.5 transition-all ${
                    isDarkMode 
                      ? 'bg-white border border-gray-200 hover:border-yellow-400/50' 
                      : 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-400/50'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    {/* Product Image */}
                    <div className="w-20 h-20 mx-auto rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      {(item.productImages?.length || item.images?.length) ? (
                        <img 
                          src={item.productImages?.[0] || item.images?.[0]} 
                          alt={item.sku} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-xs mb-0.5 truncate text-gray-900">
                            {item.sku}
                          </h3>
                          <p className="text-[10px] text-gray-600">
                            {item.category}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="p-1.5 rounded-md transition-all flex-shrink-0 hover:bg-red-100 text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Product Specs */}
                      <div className="flex flex-wrap gap-1 mb-1.5">

                        {item.watt && item.watt !== '-' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                            {item.watt}W
                          </span>
                        )}
                        {item.lumen && item.lumen !== '-' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                            {item.lumen.toLowerCase().includes('lm') ? item.lumen : `${item.lumen}lm`}
                          </span>
                        )}
                        {item.beamAngle && item.beamAngle !== '-' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700">
                            {item.beamAngle}
                          </span>
                        )}
                        {item.ipRating && item.ipRating !== 'N/A' && (
                          <span className="inline-block bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {item.ipRating}
                          </span>
                        )}
                      </div>

                      {/* Quantity and Price */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                          <button
                            onClick={() => decreaseQuantity(item.cartItemId)}
                            className="w-6 h-6 rounded flex items-center justify-center transition-all hover:bg-gray-200 text-gray-900"
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
                            className="w-6 h-6 rounded flex items-center justify-center transition-all hover:bg-gray-200 text-gray-900"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-500">
                            {formatPrice(item.price ?? 0)} × {item.quantity}
                          </p>
                          <p className="text-sm font-bold text-yellow-600">
                            {formatPrice((item.price ?? 0) * (item.quantity ?? 1))}
                          </p>
                        </div>
                      </div>

                      {/* Add Driver Button */}
                      {!item.isDriver && (
                        <button
                          onClick={() => fetchDriversForProduct(item)}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all text-xs font-semibold"
                        >
                          <Zap className="w-3 h-3" />
                          Add Driver
                        </button>
                      )}

                      {/* Associated Drivers */}
                      {!item.isDriver && getDriversForProduct(item.cartItemId).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">Drivers:</p>
                          {getDriversForProduct(item.cartItemId).map((driver) => (
                            <div key={driver.cartItemId} className="flex items-center justify-between gap-1 mb-1 p-1.5 bg-blue-50 rounded">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-blue-900 truncate">{driver.name}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[9px] text-blue-700">Qty:</span>
                                  <div className="flex items-center gap-1 bg-white border border-blue-200 rounded p-0.5 shrink-0">
                                    <button onClick={() => decreaseQuantity(driver.cartItemId)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"><Minus className="w-2.5 h-2.5" /></button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={driver.quantity || 1}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        updateQuantity(driver.cartItemId, value);
                                      }}
                                      className="w-6 text-center font-bold text-[10px] outline-none bg-transparent text-gray-900"
                                    />
                                    <button onClick={() => increaseQuantity(driver.cartItemId)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"><Plus className="w-2.5 h-2.5" /></button>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => removeFromCart(driver.cartItemId)}
                                className="p-1 rounded hover:bg-red-100 text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {/* Clear Cart Button - Mobile */}
              <button
                onClick={() => {
                  if (confirm('Remove all products?')) {
                    clearCart();
                  }
                }}
                className={`w-full sm:hidden mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  isDarkMode 
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
              <div className={`rounded-lg p-4 sticky top-6 ${
                isDarkMode ? 'bg-gray-900/50 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'
              }`}>
                <h2 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Summary
                </h2>

                {/* Contact Details */}
                <div className="mb-4">
                  <h3 className={`text-xs font-bold uppercase tracking-wide mb-3 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Your Details
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={userInfo.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Phone className="w-3.5 h-3.5" />
                        Mobile
                      </label>
                      <input
                        type="tel"
                        name="mobile"
                        value={userInfo.mobile}
                        onChange={handleChange}
                        placeholder="+1234567890"
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                        Attn (Name)
                      </label>
                      <input
                        type="text"
                        name="project"
                        value={userInfo.project}
                        onChange={handleChange}
                        placeholder="Contact person name"
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                        Company
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={userInfo.company}
                        onChange={handleChange}
                        placeholder="Company name"
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
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
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <FileText className="w-3.5 h-3.5" />
                        Invoice No
                      </label>
                      <input
                        type="text"
                        name="invoiceNo"
                        value={userInfo.invoiceNo}
                        onChange={handleChange}
                        placeholder="e.g., QT-12345678"
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none ${
                          isDarkMode 
                            ? 'bg-black border border-white/20 text-white placeholder-gray-500 focus:border-yellow-400' 
                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-400'
                        }`}
                      />
                    </div>

                    {/* Address Selector */}
                    <div>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                        Select Address
                      </label>
                      <select
                        value={selectedAddress}
                        onChange={(e) => setSelectedAddress(e.target.value as 'bahrain' | 'uae' | 'bangalore' | 'delhi')}
                        className={`w-full px-3 py-2 rounded-md text-xs transition-all outline-none cursor-pointer ${
                          isDarkMode 
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
                  </div>
                </div>

                {/* Final Total */}
                <div className={`p-3 rounded-lg mb-4 ${
                  isDarkMode ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Final Total
                    </span>
                    <span className={`text-xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      {currencyInfo.symbol} {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Discount Slider */}
                <div className="mb-4">
                  <h3 className={`text-xs font-bold uppercase tracking-wide mb-3 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    💎 Apply Discount
                  </h3>
                  <div className={`p-4 rounded-xl border ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-400/40 shadow-xl shadow-yellow-400/10' 
                      : 'bg-gradient-to-br from-white to-yellow-50/30 border-yellow-400/50 shadow-xl'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Discount Rate
                      </span>
                      <div className={`px-4 py-1.5 rounded-lg font-bold text-lg transition-all ${
                        isDarkMode 
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
                      <div className={`p-3 rounded-lg mb-3 border-l-4 transition-all ${
                        isDarkMode 
                          ? 'bg-green-500/10 border-green-400 shadow-md shadow-green-400/10' 
                          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500 shadow-md'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                             Total Savings
                          </span>
                          <span className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            -{currencyInfo.symbol} {discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowContactPopup(true)}
                      className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all border-2 ${
                        isDarkMode 
                          ? 'bg-white text-black border-white hover:bg-gray-100 hover:shadow-lg' 
                          : 'bg-black text-white border-black hover:bg-gray-800 hover:shadow-xl'
                      }`}
                    >
                      Request Custom Quotation
                    </button>
                  </div>

                  {showError && (
                    <div className={`mt-3 p-2 rounded-md flex items-start gap-2 ${
                      isDarkMode 
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
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                      isDarkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white border border-white/20' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Edit Terms & Conditions
                  </button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={exportPDF}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-sm transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>

                    <button
                      onClick={exportExcel}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-sm transition-all"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
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
          <div className={`max-w-2xl w-full rounded-xl ${
            isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
          }`}>
            {/* Header */}
            <div className={`p-6 border-b ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
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
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
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
                <div className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
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
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
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
                   <div className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Delhi
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      <a href="mailto:ankit.mittal@qliteglobal.com" className={`hover:text-yellow-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        ankit.mittal@qliteglobal.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`mt-4 p-3 rounded-lg text-center ${
              isDarkMode ? 'bg-gray-800/50 border border-white/10' : 'bg-gray-50 border border-gray-200'
            }`}>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Our sales team typically responds within the business hours
              </p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Driver Selection Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-5xl w-full rounded-xl max-h-[85vh] overflow-hidden ${
            isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
          }`}>
            {/* Header - Sticky */}
            <div className={`sticky top-0 z-10 p-4 border-b ${
              isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Zap className="w-5 h-5 text-blue-500" />
                    Select Driver for {selectedProductForDriver?.sku}
                    {selectedProductForDriver?.watt && (
                      <span className="text-blue-500">
                        ({selectedProductForDriver.watt}W)
                      </span>
                    )}
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {availableDrivers.length} driver{availableDrivers.length !== 1 ? 's' : ''} available
                  </p>
                </div>
                <button
                  onClick={handleCloseDriverModal}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search Bar */}
              {!loadingDrivers && availableDrivers.length > 0 && (
                <div className="mt-4">
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <input
                      type="text"
                      placeholder="Search by name, SKU, series, voltage, type..."
                      value={driverSearchTerm}
                      onChange={(e) => setDriverSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-10 py-2.5 rounded-lg text-sm transition-all outline-none ${
                        isDarkMode 
                          ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500' 
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                    />
                    {driverSearchTerm && (
                      <button
                        onClick={() => setDriverSearchTerm('')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${
                          isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Results Count */}
                  {driverSearchTerm && (() => {
                    const { indoor, outdoor } = categorizeDrivers();
                    const totalFiltered = indoor.length + outdoor.length;
                    if (totalFiltered < availableDrivers.length) {
                      return (
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Showing {totalFiltered} of {availableDrivers.length} drivers
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-240px)]">
              {loadingDrivers ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className={`w-12 h-12 border-4 rounded-full animate-spin mb-4 ${
                    isDarkMode ? 'border-white/10 border-t-blue-500' : 'border-gray-200 border-t-blue-500'
                  }`}></div>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Loading drivers...</p>
                </div>
              ) : availableDrivers.length === 0 ? (
                <div className="text-center py-12">
                  <Package className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    No drivers available
                  </p>
                  <p className={`mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    No drivers have been added to the system yet
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    Add drivers in the admin panel to make them available
                  </p>
                </div>
              ) : (
                <div>
                  {(() => {
                    const { indoor, outdoor } = categorizeDrivers();
                    const totalFiltered = indoor.length + outdoor.length;
                    
                    // Show "No results" message if search is applied but no drivers match
                    if (totalFiltered === 0 && driverSearchTerm) {
                      return (
                        <div className="text-center py-12">
                          <Search className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                          <p className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            No drivers found
                          </p>
                          <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Try a different search term
                          </p>
                          <button
                            onClick={() => setDriverSearchTerm('')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              isDarkMode 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            Clear Search
                          </button>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Indoor Drivers Section */}
                        {indoor.length > 0 && (
                          <div className={`rounded-lg border p-4 ${
                            isDarkMode ? 'bg-gray-800/30 border-white/10' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                              isDarkMode ? 'border-white/10' : 'border-gray-200'
                            }`}>
                              <div className={`p-1.5 rounded-lg ${
                                isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
                              }`}>
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                              </div>
                              <div>
                                <h4 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  Indoor Drivers
                                </h4>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  IP Rating ≤ 64 ({indoor.length} driver{indoor.length !== 1 ? 's' : ''})
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                              {indoor.map((driver) => (
                    <div
                      key={driver._id}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isDarkMode 
                          ? 'bg-gray-800/50 border-white/10 hover:border-blue-500/50 hover:bg-gray-800' 
                          : 'bg-white border-gray-200 hover:border-blue-500/50 shadow-sm hover:shadow-md'
                      }`}
                      onClick={() => handleAddDriver(driver)}
                    >
                      {/* Header with Name and Price */}
                      <div className="flex items-start justify-between mb-2 pb-2 border-b border-gray-200/30">
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-sm mb-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {driver.name}
                          </h4>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {driver.sku}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-base font-bold text-blue-600 whitespace-nowrap">
                            {formatPrice(driver.price)}
                          </p>
                        </div>
                      </div>

                      {/* Compact Specifications */}
                      <div className="space-y-1 mb-2">
                        {driver.wattageRange && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Power:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.wattageRange.min}-{driver.wattageRange.max}W
                            </span>
                          </div>
                        )}
                        
                        {driver.outputVoltage && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Output:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.outputVoltage}
                            </span>
                          </div>
                        )}
                        
                        {driver.outputCurrent && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Current:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.outputCurrent}
                            </span>
                          </div>
                        )}
                        

                        
                        {driver.ipRating && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>IP Rating:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.ipRating}
                            </span>
                          </div>
                        )}
                        
                        {driver.type && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Type:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.type}
                            </span>
                          </div>
                        )}
                        
                        {driver.series && (
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Series:</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {driver.series}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Add Button - Compact */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddDriver(driver);
                        }}
                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Outdoor Drivers Section */}
                        {outdoor.length > 0 && (
                          <div className={`rounded-lg border p-4 ${
                            isDarkMode ? 'bg-gray-800/30 border-white/10' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                              isDarkMode ? 'border-white/10' : 'border-gray-200'
                            }`}>
                              <div className={`p-1.5 rounded-lg ${
                                isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
                              }`}>
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  Outdoor Drivers
                                </h4>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  IP Rating ≥ 65 ({outdoor.length} driver{outdoor.length !== 1 ? 's' : ''})
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                              {outdoor.map((driver) => (
                                <div
                                  key={driver._id}
                                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                    isDarkMode 
                                      ? 'bg-gray-800/50 border-white/10 hover:border-blue-500/50 hover:bg-gray-800' 
                                      : 'bg-white border-gray-200 hover:border-blue-500/50 shadow-sm hover:shadow-md'
                                  }`}
                                  onClick={() => handleAddDriver(driver)}
                                >
                                  {/* Header with Name and Price */}
                                  <div className="flex items-start justify-between mb-2 pb-2 border-b border-gray-200/30">
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`font-bold text-sm mb-0.5 truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {driver.name}
                                      </h4>
                                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {driver.sku}
                                      </p>
                                    </div>
                                    <div className="text-right ml-2">
                                      <p className="text-base font-bold text-blue-600 whitespace-nowrap">
                                        {formatPrice(driver.price)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Compact Specifications */}
                                  <div className="space-y-1 mb-2">
                                    {driver.wattageRange && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Power:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.wattageRange.min}-{driver.wattageRange.max}W
                                        </span>
                                      </div>
                                    )}
                                    
                                    {driver.outputVoltage && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Output:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.outputVoltage}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {driver.outputCurrent && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Current:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.outputCurrent}
                                        </span>
                                      </div>
                                    )}
                                    

                                    
                                    {driver.ipRating && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>IP Rating:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.ipRating}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {driver.type && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Type:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.type}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {driver.series && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Series:</span>
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                          {driver.series}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Add Button - Compact */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddDriver(driver);
                                    }}
                                    className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-3xl w-full rounded-xl max-h-[90vh] overflow-hidden ${
            isDarkMode ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200 shadow-lg'
          }`}>
            {/* Header */}
            <div className={`p-4 border-b ${
              isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
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
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
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
                    className={`w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none ${
                      isDarkMode 
                        ? 'bg-gray-800 border border-white/20 text-white placeholder-gray-500 focus:border-blue-500' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    Your name will appear after "Yours Sincerely" in the quotation
                  </p>
                </div>

                {/* Preview */}
                <div className={`mt-6 p-4 rounded-lg border ${
                  isDarkMode ? 'bg-gray-800/50 border-white/10' : 'bg-gray-50 border-gray-200'
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
            <div className={`p-4 border-t ${
              isDarkMode ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    isDarkMode 
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
    </div>
  );
}
