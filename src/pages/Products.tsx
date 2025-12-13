import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Package, Archive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  product_type: 'stockable' | 'service';
  unit: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  category_id: string | null;
  revenue_account_id: string | null;
  cogs_account_id: string | null;
  category?: Category;
  revenue_account?: { id: string; code: string; name: string };
  cogs_account?: { id: string; code: string; name: string };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

export const Products: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { accounts, getRevenueAccounts, getCogsAccounts, getExpenseAccounts } = useAccounts();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    product_type: 'stockable' as 'stockable' | 'service',
    category_id: '',
    unit: 'pcs',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    revenue_account_id: '',
    cogs_account_id: '',
  });

  const fetchProducts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name),
        revenue_account:chart_of_accounts!products_revenue_account_id_fkey(id, code, name),
        cogs_account:chart_of_accounts!products_cogs_account_id_fkey(id, code, name)
      `)
      .eq('company_id', selectedCompany.id)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } else {
      setProducts(data || []);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('company_id', selectedCompany.id)
      .order('name');

    setCategories(data || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const productData = {
      sku: formData.sku,
      name: formData.name,
      product_type: formData.product_type,
      category_id: formData.category_id || null,
      unit: formData.unit,
      unit_price: parseFloat(formData.unit_price) || 0,
      cost_price: parseFloat(formData.cost_price) || 0,
      stock_quantity: formData.product_type === 'stockable' ? parseFloat(formData.stock_quantity) || 0 : 0,
      revenue_account_id: formData.revenue_account_id || null,
      cogs_account_id: formData.cogs_account_id || null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        toast.error('Failed to update product');
      } else {
        toast.success('Product updated successfully');
        fetchProducts();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert({
          ...productData,
          company_id: selectedCompany.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('SKU already exists');
        } else {
          toast.error('Failed to create product');
        }
      } else {
        toast.success('Product created successfully');
        fetchProducts();
      }
    }

    setIsDialogOpen(false);
    setEditingProduct(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      product_type: 'stockable',
      category_id: '',
      unit: 'pcs',
      unit_price: '',
      cost_price: '',
      stock_quantity: '',
      revenue_account_id: '',
      cogs_account_id: '',
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      product_type: product.product_type,
      category_id: product.category_id || '',
      unit: product.unit,
      unit_price: product.unit_price.toString(),
      cost_price: product.cost_price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      revenue_account_id: product.revenue_account_id || '',
      cogs_account_id: product.cogs_account_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted successfully');
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || product.product_type === filterType;
    return matchesSearch && matchesType;
  });

  // Get available accounts
  const revenueAccounts = getRevenueAccounts();
  const cogsAccounts = [...getCogsAccounts(), ...getExpenseAccounts()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your products and services
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setEditingProduct(null);
                resetForm();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Create New Product'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">SKU</label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g., PRD-001"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Product Type</label>
                  <Select
                    value={formData.product_type}
                    onValueChange={(value: 'stockable' | 'service') => 
                      setFormData({ ...formData, product_type: value })
                    }
                  >
                    <SelectTrigger className="input-field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockable">Stockable</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="form-label">Product Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Category</label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger className="input-field">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="form-label">Unit</label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., pcs, kg, m"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Unit Price (Sell)</label>
                  <Input
                    type="number"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    placeholder="0"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Cost Price (Buy)</label>
                  <Input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              {formData.product_type === 'stockable' && (
                <div>
                  <label className="form-label">Initial Stock</label>
                  <Input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
              )}

              {/* Account Linking Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-foreground mb-3">Account Linking</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Revenue Account</label>
                    <Select
                      value={formData.revenue_account_id}
                      onValueChange={(value) => setFormData({ ...formData, revenue_account_id: value })}
                    >
                      <SelectTrigger className="input-field">
                        <SelectValue placeholder="Select revenue account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Account</SelectItem>
                        {revenueAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Used when selling this product</p>
                  </div>
                  <div>
                    <label className="form-label">COGS / Expense Account</label>
                    <Select
                      value={formData.cogs_account_id}
                      onValueChange={(value) => setFormData({ ...formData, cogs_account_id: value })}
                    >
                      <SelectTrigger className="input-field">
                        <SelectValue placeholder="Select COGS account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Account</SelectItem>
                        {cogsAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Used for cost of goods sold</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="pl-10 input-field"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48 input-field">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="stockable">Stockable</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Get started by adding your first product'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product, index) => (
            <Card 
              key={product.id} 
              className="animate-fade-in hover:shadow-lg transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    product.product_type === 'stockable' 
                      ? 'bg-primary/10' 
                      : 'bg-accent/10'
                  )}>
                    {product.product_type === 'stockable' ? (
                      <Package className="w-6 h-6 text-primary" />
                    ) : (
                      <Archive className="w-6 h-6 text-accent" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                  <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                  {product.category && (
                    <p className="text-xs text-muted-foreground">{product.category.name}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    'badge-status',
                    product.product_type === 'stockable' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-accent/10 text-accent'
                  )}>
                    {product.product_type === 'stockable' ? 'Stockable' : 'Service'}
                  </span>
                  <span className="text-sm text-muted-foreground">{product.unit}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Sell Price</p>
                    <p className="font-semibold text-success">{formatCurrency(product.unit_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost Price</p>
                    <p className="font-medium text-muted-foreground">{formatCurrency(product.cost_price)}</p>
                  </div>
                </div>

                {product.product_type === 'stockable' && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Stock</p>
                      <p className={cn(
                        'font-semibold',
                        product.stock_quantity <= 0 
                          ? 'text-destructive' 
                          : product.stock_quantity < 10 
                            ? 'text-warning' 
                            : 'text-foreground'
                      )}>
                        {product.stock_quantity} {product.unit}
                      </p>
                    </div>
                  </div>
                )}

                {/* Account Links */}
                {(product.revenue_account || product.cogs_account) && (
                  <div className="mt-4 pt-4 border-t border-border space-y-1">
                    {product.revenue_account && (
                      <p className="text-xs text-muted-foreground">
                        Revenue: <span className="text-foreground">{product.revenue_account.code}</span>
                      </p>
                    )}
                    {product.cogs_account && (
                      <p className="text-xs text-muted-foreground">
                        COGS: <span className="text-foreground">{product.cogs_account.code}</span>
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;