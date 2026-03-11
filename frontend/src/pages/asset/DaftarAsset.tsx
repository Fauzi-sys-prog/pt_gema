import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { Asset } from '../../contexts/AppContext';
import api from '../../services/api';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Wrench, 
  Truck, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Trash2,
  Edit
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';

export default function DaftarAsset() {
  const { assetList, suratJalanList, addAsset, updateAsset, deleteAsset } = useApp();
  const [serverAssetList, setServerAssetList] = useState<Asset[] | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [usageFilter, setUsageFilter] = useState<'All' | 'On Rent'>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState('');
  const [editingAsset, setEditingAsset] = useState<Partial<Asset>>({
    name: '',
    assetCode: '',
    category: 'Heavy Equipment',
    location: '',
    status: 'Available',
    condition: 'Good'
  });
  
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    name: '',
    assetCode: '',
    category: 'Heavy Equipment',
    location: '',
    status: 'Available',
    condition: 'Good'
  });

  const normalizeList = useCallback((payload: unknown): Asset[] => {
    if (!Array.isArray(payload)) {
      if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
        return normalizeList((payload as { items: unknown[] }).items);
      }
      return [];
    }

    return payload.map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const wrappedPayload =
        rec.payload && typeof rec.payload === 'object' && !Array.isArray(rec.payload)
          ? (rec.payload as Record<string, unknown>)
          : null;
      if (wrappedPayload) {
        return {
          ...wrappedPayload,
          id: String(wrappedPayload.id || rec.entityId || rec.id || ''),
        } as Asset;
      }
      return rec as Asset;
    });
  }, []);

  const loadAssets = useCallback(async (silent = true) => {
    if (!silent) setIsLoadingAssets(true);
    try {
      const response = await api.get('/assets');
      setServerAssetList(normalizeList(response.data));
    } catch {
      setServerAssetList(null);
      if (!silent) toast.error('Gagal memuat data asset dari server');
    } finally {
      setIsLoadingAssets(false);
    }
  }, [normalizeList]);

  useEffect(() => {
    void loadAssets(true);
    return undefined;
  }, [loadAssets]);

  const effectiveAssetList = serverAssetList ?? assetList;

  const activeEquipmentLoans = useMemo(
    () =>
      (suratJalanList || []).filter((sj) => {
        if (sj.sjType !== 'Equipment Loan') return false;
        const delivery = String(sj.deliveryStatus || '').toLowerCase();
        const ret = String(sj.returnStatus || '').toLowerCase();
        if (delivery === 'returned' || ret === 'complete') return false;
        return true;
      }),
    [suratJalanList]
  );

  const onRentMap = useMemo(() => {
    const byAssetId = new Map<string, { sjNo: string; tujuan: string }>();
    const byAssetCode = new Map<string, { sjNo: string; tujuan: string }>();
    for (const sj of activeEquipmentLoans) {
      const info = { sjNo: sj.noSurat || '-', tujuan: sj.tujuan || '-' };
      const assetId = String(sj.assetId || '').trim();
      const assetCode = String(sj.noPolisi || '').trim().toLowerCase();
      if (assetId) byAssetId.set(assetId, info);
      if (assetCode) byAssetCode.set(assetCode, info);
    }
    return { byAssetId, byAssetCode };
  }, [activeEquipmentLoans]);

  const isAssetOnRent = useCallback(
    (asset: Asset) => {
      if (onRentMap.byAssetId.has(asset.id)) return true;
      return onRentMap.byAssetCode.has(String(asset.assetCode || '').trim().toLowerCase());
    },
    [onRentMap]
  );

  const getAssetRentalInfo = useCallback(
    (asset: Asset) => {
      const fromId = onRentMap.byAssetId.get(asset.id);
      if (fromId) return fromId;
      return onRentMap.byAssetCode.get(String(asset.assetCode || '').trim().toLowerCase());
    },
    [onRentMap]
  );

  const filteredAssets = effectiveAssetList.filter(asset => {
    const matchesSearch = 
      (asset.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (asset.assetCode || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || asset.category === filterCategory;
    const matchesUsage = usageFilter === 'All' || (usageFilter === 'On Rent' && isAssetOnRent(asset));
    return matchesSearch && matchesCategory && matchesUsage;
  });

  const handleAddAsset = async () => {
    if (!newAsset.name || !newAsset.assetCode) {
      toast.error('Nama dan Kode Asset wajib diisi');
      return;
    }
    
    const asset: Asset = {
      id: `AST-${Date.now()}`,
      name: newAsset.name || '',
      assetCode: newAsset.assetCode || '',
      category: newAsset.category || 'Heavy Equipment',
      location: newAsset.location || '',
      status: (newAsset.status as any) || 'Available',
      condition: (newAsset.condition as any) || 'Good',
      purchaseDate: new Date().toISOString().split('T')[0]
    };

    try {
      await addAsset(asset);
      setIsAddModalOpen(false);
      setNewAsset({
        name: '',
        assetCode: '',
        category: 'Heavy Equipment',
        location: '',
        status: 'Available',
        condition: 'Good'
      });
      toast.success('Asset berhasil ditambahkan');
      await loadAssets(true);
    } catch {
      // toast handled in context
    }
  };

  const handleOpenEditAsset = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setEditingAsset({
      name: asset.name || '',
      assetCode: asset.assetCode || '',
      category: asset.category || 'Heavy Equipment',
      location: asset.location || '',
      status: asset.status || 'Available',
      condition: asset.condition || 'Good',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditAsset = async () => {
    const safeId = String(editingAssetId || '').trim();
    if (!safeId) {
      toast.error('ID asset tidak valid.');
      return;
    }
    if (!editingAsset.name || !editingAsset.assetCode) {
      toast.error('Nama dan Kode Asset wajib diisi');
      return;
    }

    try {
      await updateAsset(safeId, {
        name: editingAsset.name || '',
        assetCode: editingAsset.assetCode || '',
        category: editingAsset.category || 'Heavy Equipment',
        location: editingAsset.location || '',
        status: (editingAsset.status as any) || 'Available',
        condition: (editingAsset.condition as any) || 'Good',
      });
      setIsEditModalOpen(false);
      setEditingAssetId('');
      toast.success('Asset berhasil diupdate');
      await loadAssets(true);
    } catch {
      // toast handled in context
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Available': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'Under Maintenance': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'In Use': return <Settings className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Heavy Equipment': return <Settings className="w-5 h-5" />;
      case 'Vehicle': return <Truck className="w-5 h-5" />;
      case 'Tools': return <Wrench className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Daftar Asset</h1>
          <p className="text-slate-500 mt-1 font-medium">Manajemen peralatan dan aset PT Gema Teknik Perkasa</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-lg shadow-red-100 px-6 py-6 rounded-xl font-bold transition-all flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Tambah Asset Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Tambah Asset</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="font-semibold text-slate-700">Kode Asset</Label>
                  <Input 
                    id="code" 
                    placeholder="Contoh: GTP-HE-001" 
                    className="rounded-lg border-slate-200"
                    value={newAsset.assetCode}
                    onChange={e => setNewAsset({...newAsset, assetCode: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-semibold text-slate-700">Kategori</Label>
                  <Select 
                    value={newAsset.category} 
                    onValueChange={v => setNewAsset({...newAsset, category: v})}
                  >
                    <SelectTrigger className="rounded-lg border-slate-200">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Heavy Equipment">Heavy Equipment</SelectItem>
                      <SelectItem value="Vehicle">Vehicle</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Office">Office Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold text-slate-700">Nama Asset</Label>
                <Input 
                  id="name" 
                  placeholder="Nama lengkap peralatan" 
                  className="rounded-lg border-slate-200"
                  value={newAsset.name}
                  onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="font-semibold text-slate-700">Lokasi</Label>
                  <Input 
                    id="location" 
                    placeholder="Workshop / Site" 
                    className="rounded-lg border-slate-200"
                    value={newAsset.location}
                    onChange={e => setNewAsset({...newAsset, location: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition" className="font-semibold text-slate-700">Kondisi</Label>
                  <Select 
                    value={newAsset.condition} 
                    onValueChange={v => setNewAsset({...newAsset, condition: v as any})}
                  >
                    <SelectTrigger className="rounded-lg border-slate-200">
                      <SelectValue placeholder="Pilih Kondisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-lg font-semibold">Batal</Button>
              <Button onClick={handleAddAsset} className="bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg font-bold">Simpan Asset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Edit Asset</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code" className="font-semibold text-slate-700">Kode Asset</Label>
                  <Input
                    id="edit-code"
                    placeholder="Contoh: GTP-HE-001"
                    className="rounded-lg border-slate-200"
                    value={editingAsset.assetCode || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, assetCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="font-semibold text-slate-700">Kategori</Label>
                  <Select
                    value={String(editingAsset.category || 'Heavy Equipment')}
                    onValueChange={v => setEditingAsset({ ...editingAsset, category: v })}
                  >
                    <SelectTrigger className="rounded-lg border-slate-200">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Heavy Equipment">Heavy Equipment</SelectItem>
                      <SelectItem value="Vehicle">Vehicle</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Office">Office Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name" className="font-semibold text-slate-700">Nama Asset</Label>
                <Input
                  id="edit-name"
                  placeholder="Nama lengkap peralatan"
                  className="rounded-lg border-slate-200"
                  value={editingAsset.name || ''}
                  onChange={e => setEditingAsset({ ...editingAsset, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-location" className="font-semibold text-slate-700">Lokasi</Label>
                  <Input
                    id="edit-location"
                    placeholder="Workshop / Site"
                    className="rounded-lg border-slate-200"
                    value={editingAsset.location || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="font-semibold text-slate-700">Status</Label>
                  <Select
                    value={String(editingAsset.status || 'Available')}
                    onValueChange={v => setEditingAsset({ ...editingAsset, status: v as any })}
                  >
                    <SelectTrigger className="rounded-lg border-slate-200">
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="In Use">In Use</SelectItem>
                      <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Scrapped">Scrapped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-condition" className="font-semibold text-slate-700">Kondisi</Label>
                  <Select
                    value={String(editingAsset.condition || 'Good')}
                    onValueChange={v => setEditingAsset({ ...editingAsset, condition: v as any })}
                  >
                    <SelectTrigger className="rounded-lg border-slate-200">
                      <SelectValue placeholder="Pilih Kondisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-lg font-semibold">Batal</Button>
              <Button onClick={handleSaveEditAsset} className="bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg font-bold">Update Asset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Asset</p>
            <p className="text-2xl font-bold text-slate-900">{effectiveAssetList.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tersedia</p>
            <p className="text-2xl font-bold text-slate-900">{effectiveAssetList.filter(a => a.status === 'Available').length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-orange-50 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Maintenance</p>
            <p className="text-2xl font-bold text-slate-900">{effectiveAssetList.filter(a => a.status === 'Under Maintenance').length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-purple-50 p-3 rounded-xl">
            <Truck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Sedang Disewa</p>
            <p className="text-2xl font-bold text-slate-900">{effectiveAssetList.filter((a) => isAssetOnRent(a)).length}</p>
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Cari asset berdasarkan nama atau kode..." 
            className="pl-10 rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as 'All' | 'On Rent')}>
            <SelectTrigger className="w-[160px] rounded-xl border-slate-100 bg-slate-50/50">
              <Truck className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Pemakaian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Semua Asset</SelectItem>
              <SelectItem value="On Rent">On Rent / Disewa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px] rounded-xl border-slate-100 bg-slate-50/50">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Semua Kategori</SelectItem>
              <SelectItem value="Heavy Equipment">Heavy Equipment</SelectItem>
              <SelectItem value="Vehicle">Vehicle</SelectItem>
              <SelectItem value="Tools">Tools</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoadingAssets ? (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-4">
            <h3 className="text-xl font-bold text-slate-900">Memuat data asset...</h3>
          </div>
        ) : filteredAssets.length > 0 ? (
          filteredAssets.map(asset => (
            <div 
              key={asset.id} 
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              {isAssetOnRent(asset) && (
                <div className="px-6 pt-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                    <Truck className="w-3 h-3" />
                    On Rent
                  </div>
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-xl ${
                    asset.category === 'Heavy Equipment' ? 'bg-blue-50 text-blue-600' : 
                    asset.category === 'Vehicle' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {getCategoryIcon(asset.category)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      asset.status === 'Available' ? 'bg-green-50 text-green-700' : 
                      asset.status === 'Under Maintenance' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {getStatusIcon(asset.status)}
                      {asset.status}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem
                          className="gap-2 font-medium cursor-pointer"
                          onClick={() => handleOpenEditAsset(asset)}
                        >
                          <Edit className="w-4 h-4 text-slate-500" />
                          Edit Asset
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 font-medium text-red-600 cursor-pointer"
                          onClick={async () => {
                            const safeId = String(asset.id || '').trim();
                            if (!safeId) {
                              toast.error('ID asset tidak valid. Silakan refresh data.');
                              return;
                            }
                            try {
                              await deleteAsset(safeId);
                              setServerAssetList((prev) => (prev ? prev.filter((item) => item.id !== safeId) : prev));
                              toast.success('Asset berhasil dihapus');
                              await loadAssets(true);
                            } catch {
                              // toast handled in context
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Hapus Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1 mb-6">
                  <h3 className="font-extrabold text-xl text-slate-900 group-hover:text-[#B91C1C] transition-colors line-clamp-1">{asset.name}</h3>
                  <p className="text-slate-500 font-mono text-xs font-bold tracking-wider">{asset.assetCode}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Location</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{asset.location}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Condition</p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        asset.condition === 'Good' ? 'bg-green-500' : 
                        asset.condition === 'Fair' ? 'bg-orange-500' : 'bg-red-500'
                      }`} />
                      <p className="text-sm font-semibold text-slate-700">{asset.condition}</p>
                    </div>
                  </div>
                </div>

                {asset.nextMaintenance && (
                  <div className="mt-6 p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-tight">Next Service</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{asset.nextMaintenance}</span>
                  </div>
                )}
                {isAssetOnRent(asset) && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                      Disewa via {getAssetRentalInfo(asset)?.sjNo || '-'}
                    </p>
                    <p className="text-xs font-semibold text-purple-900 mt-1 truncate">
                      Tujuan: {getAssetRentalInfo(asset)?.tujuan || '-'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-4">
            <div className="bg-slate-50 p-6 rounded-full mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Tidak ada asset ditemukan</h3>
            <p className="text-slate-500 max-w-xs mt-2">Coba sesuaikan kata kunci pencarian atau filter kategori Anda.</p>
            <Button 
              variant="outline" 
              className="mt-6 rounded-xl font-bold border-slate-200 hover:bg-slate-50"
              onClick={() => {
                setSearchTerm('');
                setFilterCategory('All');
                setUsageFilter('All');
              }}
            >
              Reset Pencarian
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
