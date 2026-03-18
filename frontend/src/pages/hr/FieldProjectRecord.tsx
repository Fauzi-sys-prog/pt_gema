import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Calendar, Briefcase, MapPin, Download, ChevronLeft, ChevronRight, Filter, CheckCircle2, AlertCircle, Clock, DollarSign, User, LayoutGrid, List, Save, FileText, FileSpreadsheet, FileDown, Package } from 'lucide-react'; import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import type { Asset, Employee, Project } from '../../contexts/AppContext';
import api from '../../services/api';

interface ProjectWorker {
  id: string;
  employeeId: string;
  workerType: 'internal' | 'thl' | 'borongan' | 'subkon';
  workerName: string;
  role: string;
  rate: number;
}

export default function FieldProjectRecord() {
  const { projectList = [], employeeList = [], assetList = [], updateProject, materialRequestList = [], addAuditLog } = useApp();
  const { currentUser } = useAuth();
  const [serverProjectList, setServerProjectList] = useState<Project[] | null>(null);
  const [serverEmployeeList, setServerEmployeeList] = useState<Employee[] | null>(null);
  const [serverAssetList, setServerAssetList] = useState<Asset[] | null>(null);
  const [serverProjectLaborList, setServerProjectLaborList] = useState<any[] | null>(null);
  const [serverKasbonList, setServerKasbonList] = useState<any[] | null>(null);
  const [serverMaterialRequestList, setServerMaterialRequestList] = useState<any[] | null>(null);
  const [serverFleetHealthList, setServerFleetHealthList] = useState<any[] | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeView, setActiveView] = useState<'attendance' | 'kasbon' | 'equipment' | 'material'>('attendance');
  const [showKasbonModal, setShowKasbonModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<ProjectWorker | null>(null);
  const [workerRoster, setWorkerRoster] = useState<ProjectWorker[]>([]);

  // New states to fix ReferenceErrors
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [kasbonAmount, setKasbonAmount] = useState('');
  const [kasbonDate, setKasbonDate] = useState(new Date().toISOString().split('T')[0]);

  const normalizeList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
      return payload.map((row: any) => {
        if (row && typeof row === 'object' && 'payload' in row) {
          const item = (row as { payload?: any }).payload || {};
          const id = item.id || row.entityId || row.id;
          return { id, ...item } as T;
        }
        return row as T;
      });
    }
    if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
      return normalizeList<T>((payload as { items: unknown[] }).items);
    }
    return [];
  };

  useEffect(() => {
    let mounted = true;

    const loadPageData = async () => {
      try {
        const [projectsRes, employeesRes, assetsRes, projectLaborRes, kasbonsRes, materialRequestsRes, fleetHealthRes] = await Promise.all([
          api.get('/projects'),
          api.get('/employees'),
          api.get('/assets'),
          api.get('/project-labor-entries'),
          api.get('/hr/kasbons'),
          api.get('/material-requests'),
          api.get('/fleet-health'),
        ]);
        if (!mounted) return;
        setServerProjectList(normalizeList<Project>(projectsRes.data));
        setServerEmployeeList(normalizeList<Employee>(employeesRes.data));
        setServerAssetList(normalizeList<Asset>(assetsRes.data));
        setServerProjectLaborList(normalizeList<any>(projectLaborRes.data));
        setServerKasbonList(normalizeList<any>(kasbonsRes.data));
        setServerMaterialRequestList(normalizeList<any>(materialRequestsRes.data));
        setServerFleetHealthList(normalizeList<any>(fleetHealthRes.data));
      } catch {
        if (!mounted) return;
        setServerProjectList(null);
        setServerEmployeeList(null);
        setServerAssetList(null);
        setServerProjectLaborList(null);
        setServerKasbonList(null);
        setServerMaterialRequestList(null);
        setServerFleetHealthList(null);
      }
    };

    loadPageData();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveProjectList = serverProjectList ?? projectList;
  const effectiveEmployeeList = serverEmployeeList ?? employeeList;
  const effectiveAssetList = serverAssetList ?? assetList;
  const effectiveProjectLaborList = serverProjectLaborList ?? [];
  const effectiveMaterialRequestList = serverMaterialRequestList ?? materialRequestList;
  const effectiveFleetHealthList = serverFleetHealthList ?? [];

  useEffect(() => {
    if (!selectedProjectId && effectiveProjectList.length > 0) {
      setSelectedProjectId(effectiveProjectList[0].id);
    }
  }, [effectiveProjectList, selectedProjectId]);

  const selectedProject = useMemo(() => effectiveProjectList.find(p => p.id === selectedProjectId), [effectiveProjectList, selectedProjectId]);
  const projectPayloadKasbon = useMemo(() => {
    const raw = (selectedProject?.kasbon || []) as any[];
    return raw.map((k) => ({
      id: k.id || `KSB-LEGACY-${k.employeeId || 'UNK'}-${k.date || Date.now()}`,
      projectId: selectedProjectId,
      employeeId: k.employeeId || '',
      employeeName: k.employeeName || '',
      date: k.date || '',
      amount: Number(k.amount || 0),
      status: k.status || 'Approved',
    }));
  }, [selectedProject?.kasbon, selectedProjectId]);
  const effectiveKasbonList = serverKasbonList ?? projectPayloadKasbon;

  const dates = useMemo(() => {
    const arr = [];
    const base = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  }, [startDate]);

  const createWorkerId = () => `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workerSignature = (input: Partial<ProjectWorker> | any) => `${String(input.employeeId || '').trim()}::${String(input.workerName || input.employeeName || '').trim().toLowerCase()}::${String(input.workerType || '').trim().toLowerCase()}`;

  useEffect(() => {
    const laborRows = effectiveProjectLaborList.filter(
      (row: any) => String(row?.projectId || '').trim() === String(selectedProjectId || '').trim()
    );
    const rosterMap = new Map<string, ProjectWorker>();

    laborRows.forEach((row: any) => {
      const signature = workerSignature(row);
      if (!signature || rosterMap.has(signature)) return;
      rosterMap.set(signature, {
        id: createWorkerId(),
        employeeId: String(row.employeeId || ''),
        workerType: (String(row.workerType || 'thl').toLowerCase() as ProjectWorker['workerType']),
        workerName: String(row.workerName || '').trim(),
        role: String(row.role || '').trim(),
        rate: Number(row.rate || 0),
      });
    });

    effectiveKasbonList
      .filter((row: any) => String(row?.projectId || '').trim() === String(selectedProjectId || '').trim())
      .forEach((row: any) => {
        const seed = {
          employeeId: String(row.employeeId || ''),
          workerName: String(row.employeeName || '').trim(),
          workerType: 'thl',
        };
        const signature = workerSignature(seed);
        if (!signature || rosterMap.has(signature)) return;
        rosterMap.set(signature, {
          id: createWorkerId(),
          employeeId: seed.employeeId,
          workerType: 'thl',
          workerName: seed.workerName,
          role: '',
          rate: 0,
        });
      });

    setWorkerRoster(rosterMap.size > 0 ? Array.from(rosterMap.values()) : [{
      id: createWorkerId(),
      employeeId: '',
      workerType: 'thl',
      workerName: '',
      role: '',
      rate: 0,
    }]);

    const seededAttendance: Record<string, string> = {};
    laborRows.forEach((row: any) => {
      const rowDate = String(row.date || '');
      if (!dates.includes(rowDate)) return;
      const signature = workerSignature(row);
      seededAttendance[`${signature}-${rowDate}-in`] = String(row.checkIn || '07:00');
      seededAttendance[`${signature}-${rowDate}-out`] = String(row.checkOut || '17:00');
    });
    setAttendanceData(seededAttendance);
  }, [selectedProjectId, effectiveProjectLaborList, effectiveKasbonList, dates]);
  
  // Equipment State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [usageHours, setUsageHours] = useState('8');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);

  // Material Request State
  const [selectedBoqItemId, setSelectedBoqItemId] = useState('');
  const [requestQty, setRequestQty] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSaveAttendance = async () => {
    const validWorkers = workerRoster
      .map((worker) => ({
        ...worker,
        workerName: String(worker.workerName || '').trim(),
        role: String(worker.role || '').trim(),
        rate: Number(worker.rate || 0),
      }))
      .filter((worker) => worker.workerName);

    if (validWorkers.length === 0) {
      toast.error('Tambahkan minimal satu tenaga kerja proyek terlebih dulu.');
      return;
    }

    const existingRows = effectiveProjectLaborList.filter(
      (row: any) => String(row?.projectId || '').trim() === String(selectedProjectId || '').trim()
    );
    const existingMap = new Map<string, any>();
    existingRows.forEach((row: any) => {
      const key = `${workerSignature(row)}::${String(row.date || '').trim()}`;
      existingMap.set(key, row);
    });

    const requests: Promise<any>[] = [];
    validWorkers.forEach((worker) => {
      dates.forEach((date) => {
        const signature = workerSignature(worker);
        const inTime = attendanceData[`${signature}-${date}-in`] || '07:00';
        const outTime = attendanceData[`${signature}-${date}-out`] || '17:00';
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        const totalMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
        const workHours = totalMinutes / 60;
        const overtimeHours = Math.max(0, workHours - 8);
        const qtyDays = workHours > 0 ? 1 : 0;
        const amount = worker.workerType === 'internal' ? 0 : Number(worker.rate || 0) * qtyDays;
        const payload = {
          projectId: selectedProjectId,
          employeeId: worker.employeeId || undefined,
          date,
          workerType: worker.workerType,
          workerName: worker.workerName,
          role: worker.role,
          qtyDays,
          checkIn: inTime,
          checkOut: outTime,
          hoursWorked: workHours,
          overtimeHours,
          rate: Number(worker.rate || 0),
          amount,
          source: 'FIELD_RECORD',
          notes: selectedProject?.namaProject || undefined,
          createdByUserId: currentUser?.id,
          createdByName: currentUser?.fullName || currentUser?.username || 'System',
        };
        const existing = existingMap.get(`${signature}::${date}`);
        if (existing?.id) {
          requests.push(api.patch(`/project-labor-entries/${existing.id}`, payload));
        } else {
          requests.push(api.post('/project-labor-entries', { id: `PLB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...payload }));
        }
      });
    });

    try {
      await Promise.all(requests);
      const refreshed = await api.get('/project-labor-entries');
      setServerProjectLaborList(normalizeList<any>(refreshed.data));
        addAuditLog({
          action: 'PROJECT_LABOR_BULK_SYNCED',
          module: 'HR',
          entityType: 'ProjectLaborEntry',
          entityId: selectedProjectId || 'unknown-project',
          description: `${requests.length} entry tenaga kerja proyek disimpan untuk proyek ${selectedProject?.namaProject || selectedProjectId || '-'}`,
        });
      toast.success(`${requests.length} entry tenaga kerja proyek berhasil disimpan ke ledger proyek.`);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Gagal simpan tenaga kerja proyek';
      toast.error(apiMessage);
    }
  };

  const handleFinalizeReport = () => {
    addAuditLog({
      action: 'FIELD_REPORT_EXPORT_OPENED',
      module: 'HR',
      details: `Open export modal - ${selectedProject?.namaProject || 'Unknown Project'}`,
      status: 'Success',
    });
    setShowFinalizeModal(true);
  };

  const downloadBlob = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildAttendanceRows = () => {
    return workerRoster
      .filter((worker) => String(worker.workerName || '').trim())
      .flatMap((worker) =>
      dates.map((date) => {
        const signature = workerSignature(worker);
        const inTime = attendanceData[`${signature}-${date}-in`] || '07:00';
        const outTime = attendanceData[`${signature}-${date}-out`] || '17:00';
        return {
          date,
          employeeId: worker.employeeId || '',
          employeeName: worker.workerName,
          position: worker.role || '-',
          workerType: worker.workerType,
          rate: Number(worker.rate || 0),
          inTime,
          outTime,
        };
      })
    );
  };

  const buildKasbonRows = () => {
    const kasbonEntries = (effectiveKasbonList || []).filter(
      (k: any) => String(k?.projectId || '').trim() === String(selectedProjectId || '').trim()
    );
    return kasbonEntries.map((k) => ({
      id: String(k.id || ''),
      employeeId: String(k.employeeId || ''),
      date: k.date || '-',
      employeeName: k.employeeName || '-',
      amount: Number(k.amount || 0),
      status: k.status || '-',
    }));
  };
  const kasbonRows = useMemo(buildKasbonRows, [effectiveKasbonList, selectedProjectId]);
  const totalKasbonAmount = useMemo(
    () => kasbonRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [kasbonRows]
  );

  const buildEquipmentRows = () => {
    const logs = (effectiveFleetHealthList || []).filter(
      (log: any) => String(log?.projectId || '').trim() === String(selectedProjectId || '').trim()
    ) as any[];
    return logs.map((log) => ({
      date: log.date || '-',
      equipmentName: log.equipmentName || '-',
      hoursUsed: Number(log.hoursUsed || 0),
      operatorName: log.operatorName || '-',
      costPerHour: Number(log.costPerHour || 0),
      totalCost: Number(log.hoursUsed || 0) * Number(log.costPerHour || 0),
    }));
  };

  const buildMaterialRows = () => {
    const rows = (effectiveMaterialRequestList || []).filter(
      (mr: any) => String(mr?.projectId || '').trim() === String(selectedProjectId || '').trim()
    ) as any[];
    return rows.map((mr) => ({
      date: mr.requestDate || mr.requestedAt || '-',
      itemName: mr.itemName || mr.items?.[0]?.itemNama || '-',
      qty: Number(mr.quantity || mr.items?.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0) || 0),
      unit: mr.unit || mr.items?.[0]?.unit || '-',
      status: mr.status || '-',
      estimatedCost:
        Number(
          mr.estimatedCost ||
          mr.items?.reduce((sum: number, item: any) => {
            const qty = Number(item?.qty || 0);
            const unitPrice = Number(item?.unitPrice || 0);
            return sum + qty * unitPrice;
          }, 0) ||
          0
        ),
    }));
  };

  const buildReportPayload = () => {
    const attendanceRows = buildAttendanceRows();
    const kasbonRows = buildKasbonRows();
    const equipmentRows = buildEquipmentRows();
    const materialRows = buildMaterialRows();
    return {
      projectName: selectedProject?.namaProject || '-',
      startDate,
      generatedBy: currentUser?.fullName || currentUser?.username || 'System',
      generatedAt: new Date().toISOString(),
      attendanceRows,
      kasbonRows,
      equipmentRows,
      materialRows,
    };
  };

  const exportAsExcelDoc = async () => {
    const reportPayload = buildReportPayload();
    const response = await api.post('/exports/field-project-report/excel', reportPayload, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/vnd.ms-excel' });
    const filename = `weekly-report-${(selectedProject?.namaProject || 'project').replace(/\s+/g, '-').toLowerCase()}-${startDate}.xls`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsWordDoc = async () => {
    const reportPayload = buildReportPayload();

    const response = await api.post('/exports/field-project-report/word', reportPayload, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/msword' });
    const filename = `weekly-report-${(selectedProject?.namaProject || 'project').replace(/\s+/g, '-').toLowerCase()}-${startDate}.doc`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'Word' | 'Excel') => {
    try {
      if (format === 'Word') {
        await exportAsWordDoc();
      } else {
        await exportAsExcelDoc();
      }
      toast.success(`Weekly Report untuk ${selectedProject?.namaProject || 'Project'} berhasil diekspor ke ${format}!`);
      addAuditLog({
        action: 'FIELD_REPORT_EXPORTED',
        module: 'HR',
        details: `${selectedProject?.namaProject || 'Unknown Project'} exported to ${format}`,
        status: 'Success',
      });
      setShowFinalizeModal(false);
    } catch {
      toast.error(`Export ${format} gagal. Coba lagi.`);
    }
  };

  const handleAddKasbon = (worker: any) => {
    setSelectedWorker(worker);
    setKasbonAmount('');
    setKasbonDate(new Date().toISOString().split('T')[0]);
    setShowKasbonModal(true);
  };

  const handleAddEquipmentUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = effectiveAssetList.find(a => a.id === selectedAssetId);
    if (!asset) return;
    const payload = {
      id: `EQH-${Date.now()}`,
      projectId: selectedProjectId,
      assetId: asset.id,
      equipmentId: asset.id,
      equipmentName: asset.name,
      date: usageDate,
      hoursUsed: parseFloat(usageHours),
      operatorName: currentUser?.fullName || 'Field Supervisor',
      costPerHour: asset.category === 'Heavy Equipment' ? 250000 : 50000,
      status: 'Logged',
    };
    try {
      const res = await api.post('/fleet-health', payload);
      const savedRaw = res?.data || payload;
      setServerFleetHealthList((prev) => [savedRaw, ...(prev || [])]);
      addAuditLog({
        action: 'FLEET_HEALTH_CREATED',
        module: 'Operations',
        entityType: 'FleetHealth',
        entityId: String(savedRaw.id || payload.id),
        description: `Log penggunaan ${asset.name} selama ${payload.hoursUsed} jam dicatat untuk proyek ${selectedProjectId}`,
      });
      toast.success(`Log penggunaan ${asset.name} berhasil disimpan.`);
      setShowEquipmentModal(false);
      setSelectedAssetId('');
      setUsageDate(new Date().toISOString().split('T')[0]);
      setUsageHours('8');
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Gagal simpan log equipment';
      toast.error(apiMessage);
    }
  };

  const handleAddMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const boqItem = selectedProject?.boq?.find((item: any) => item.id === selectedBoqItemId);
    if (!boqItem) return;
    const qty = parseFloat(requestQty);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Qty material request harus lebih dari 0');
      return;
    }
    const materialRequestPayload = {
      id: `MR-${Date.now()}`,
      noRequest: `MR/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`,
      projectId: selectedProjectId,
      projectName: selectedProject?.namaProject || '-',
      requestedBy: currentUser?.fullName || 'Site Supervisor',
      requestedAt: requestDate,
      requestDate,
      status: 'Pending',
      itemName: boqItem.materialName || boqItem.itemDescription || '-',
      quantity: qty,
      unit: boqItem.unit || 'unit',
      estimatedCost: Number(boqItem.unitPrice || 0) * qty,
      items: [
        {
          id: `${selectedBoqItemId}-${Date.now()}`,
          itemKode: boqItem.itemKode || `ITEM-${Date.now()}`,
          itemNama: boqItem.materialName || boqItem.itemDescription || '-',
          qty,
          unit: boqItem.unit || 'unit',
          unitPrice: Number(boqItem.unitPrice || 0),
        },
      ],
    };

    try {
      const res = await api.post('/material-requests', materialRequestPayload);
      const savedRaw = res?.data || materialRequestPayload;
      setServerMaterialRequestList((prev) => [savedRaw, ...(prev || [])]);
      addAuditLog({
        action: 'MATERIAL_REQUEST_CREATED',
        module: 'Operations',
        entityType: 'MaterialRequest',
        entityId: String(savedRaw.id || materialRequestPayload.id),
        description: `Material request ${materialRequestPayload.noRequest} untuk ${materialRequestPayload.itemName} diajukan pada proyek ${selectedProjectId}`,
      });
      toast.success(`Material Request untuk ${materialRequestPayload.itemName} berhasil diajukan.`);
      setShowMaterialModal(false);
      setSelectedBoqItemId('');
      setRequestQty('');
      setRequestDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Gagal simpan material request';
      toast.error(apiMessage);
    }
  };

  const submitKasbon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;

    const amount = parseFloat(kasbonAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal kasbon tidak valid.");
      return;
    }

    const newKasbon = {
      id: `KSB-${Date.now()}`,
      projectId: selectedProjectId,
      employeeId: selectedWorker.employeeId || undefined,
      employeeName: selectedWorker.workerName,
      date: kasbonDate,
      amount: amount,
      status: 'Approved',
      approved: true,
      createdBy: currentUser?.fullName || currentUser?.username || 'System',
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await api.post('/hr/kasbons', newKasbon);
      const savedRaw = res?.data && typeof res.data === 'object' && 'payload' in res.data
        ? { id: res.data.payload?.id || res.data.entityId || res.data.id, ...(res.data.payload || {}) }
        : (res?.data || newKasbon);
      setServerKasbonList((prev) => [savedRaw, ...(prev || [])]);
      addAuditLog({
        action: 'KASBON_CREATED',
        module: 'HR',
        entityType: 'Kasbon',
        entityId: String(savedRaw.id || newKasbon.id),
        description: `Kasbon ${formatCurrency(amount)} untuk ${selectedWorker.workerName} dicatat pada proyek ${selectedProjectId}`,
      });
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message || err?.message || 'Gagal simpan kasbon';
      toast.error(apiMessage);
      return;
    }

    toast.success(`Kasbon senilai ${formatCurrency(amount)} untuk ${selectedWorker.workerName} berhasil dicatat.`);
    setShowKasbonModal(false);
    setKasbonAmount('');
    setKasbonDate(new Date().toISOString().split('T')[0]);
    setSelectedWorker(null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  const matchesWorkerKasbon = (row: any, worker: ProjectWorker) => {
    if (worker.employeeId && String(row.employeeId || '') === String(worker.employeeId)) return true;
    return String(row.employeeName || '').trim().toLowerCase() === String(worker.workerName || '').trim().toLowerCase();
  };

  const addWorkerRow = () => {
    setWorkerRoster((prev) => [
      ...prev,
      {
        id: createWorkerId(),
        employeeId: '',
        workerType: 'thl',
        workerName: '',
        role: '',
        rate: 0,
      },
    ]);
  };

  const getMaterialView = () => (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h3 className="text-xl font-black italic uppercase tracking-tighter">Material Requests (MR)</h3>
          <button 
            onClick={() => setShowMaterialModal(true)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
          >
             <Plus size={16} /> New Material Request
          </button>
       </div>

       <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-slate-900 text-white">
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest">Date</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest">Material Item (from BOQ)</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Qty</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Unit</th>
                   <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest">Status</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {buildMaterialRows().map((mr) => (
                  <tr key={mr.id} className="hover:bg-slate-50 transition-all">
                     <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{mr.requestDate}</td>
                     <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900 uppercase italic">{mr.itemName}</p>
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Ref ID: {mr.itemId}</p>
                     </td>
                     <td className="px-6 py-4 text-center text-xs font-black text-slate-900">{mr.quantity}</td>
                     <td className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">{mr.unit}</td>
                     <td className="px-6 py-4">
                        <div className={`inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          mr.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                          mr.status === 'Approved' ? 'bg-blue-100 text-blue-600' :
                          mr.status === 'Ordered' ? 'bg-purple-100 text-purple-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                           {mr.status}
                        </div>
                     </td>
                  </tr>
                ))}
                {buildMaterialRows().length === 0 && (
                  <tr>
                     <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic text-[10px] font-black uppercase tracking-widest">
                        No material requests found. Click "New Material Request" to start.
                     </td>
                  </tr>
                )}
             </tbody>
          </table>
       </div>
    </div>
  );

  const getEquipmentView = () => (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h3 className="text-xl font-black italic uppercase tracking-tighter">Equipment Usage Logs</h3>
          <button 
            onClick={() => setShowEquipmentModal(true)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
          >
             <Plus size={16} /> Log Machine Hours
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildEquipmentRows().map((log) => (
            <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
                  <Clock size={40} />
               </div>
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{log.date}</p>
                    <h4 className="text-lg font-black text-slate-900 uppercase italic leading-tight">{log.equipmentName}</h4>
                  </div>
                  <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    <span className="text-xs font-black text-blue-600">{log.hoursUsed} HRS</span>
                  </div>
               </div>
               <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black italic text-slate-500">
                    OP
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase italic">{log.operatorName}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Est. Cost</p>
                    <p className="text-[10px] font-black text-emerald-600 italic">{formatCurrency(log.hoursUsed * log.costPerHour)}</p>
                  </div>
               </div>
            </div>
          ))}
          {buildEquipmentRows().length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100 shadow-sm">
                  <Briefcase size={24} />
               </div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No equipment logs for this period</p>
            </div>
          )}
       </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <LayoutGrid size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Field Project Ledger</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Attendance & Advances (Kasbon) Integration</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative min-w-[250px]">
             <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <select 
               value={selectedProjectId}
               onChange={(e) => setSelectedProjectId(e.target.value)}
               className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
             >
                {effectiveProjectList.map(p => (
                  <option key={p.id} value={p.id}>{p.namaProject}</option>
                ))}
             </select>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button 
               onClick={() => setActiveView('attendance')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'attendance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Attendance
             </button>
             <button 
               onClick={() => setActiveView('kasbon')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'kasbon' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Kasbon
             </button>
             <button 
               onClick={() => setActiveView('equipment')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'equipment' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Equipment
             </button>
             <button 
               onClick={() => setActiveView('material')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'material' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Material
             </button>
          </div>
        </div>
      </div>

      {/* Project Banner */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 p-10 opacity-10">
            <MapPin size={120} />
         </div>
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Project</p>
               <h3 className="text-xl font-black italic uppercase tracking-tighter">{selectedProject?.namaProject || 'No Project Selected'}</h3>
            </div>
            <div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Site Location</p>
               <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                  <MapPin size={18} className="text-blue-400" />
                  {selectedProject?.customer || 'General Site'}
               </h3>
            </div>
            <div className="flex justify-end items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Physical Progress</p>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={selectedProject?.progress || 0} 
                      onChange={(e) => updateProject(selectedProjectId, { progress: parseInt(e.target.value) })}
                      className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-lg font-black text-center focus:bg-white/20 outline-none"
                    />
                    <span className="text-2xl font-black italic">%</span>
                  </div>
               </div>
               <button
                 onClick={handleFinalizeReport}
                 className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10"
               >
                  <Download size={20} />
               </button>
            </div>
         </div>
      </div>

      {activeView === 'attendance' ? (
        <div className="space-y-4">
           {/* Attendance Date Control */}
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <button 
                   onClick={() => {
                     const d = new Date(startDate);
                     d.setDate(d.getDate() - 10);
                     setStartDate(d.toISOString().split('T')[0]);
                   }}
                   className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                 >
                    <ChevronLeft size={18} />
                 </button>
                 <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-lg">
                    <Calendar size={16} className="text-blue-600" />
                    <span className="text-xs font-black uppercase italic">{formatDateShort(dates[0])} - {formatDateShort(dates[dates.length - 1])}</span>
                 </div>
                 <button 
                   onClick={() => {
                     const d = new Date(startDate);
                     d.setDate(d.getDate() + 10);
                     setStartDate(d.toISOString().split('T')[0]);
                   }}
                   className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                 >
                    <ChevronRight size={18} />
                 </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={addWorkerRow}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Plus size={16} /> Tambah Tenaga
                </button>
                <button
                  onClick={handleSaveAttendance}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                   <Save size={16} /> Save Changes
                </button>
              </div>
           </div>

           {/* The ABSEN Table Grid */}
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-900 text-white">
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 text-center w-12">No</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[170px]">Worker</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[110px]">Type</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[120px]">Role</th>
                          <th rowSpan={2} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest border-r border-white/10 min-w-[100px]">Rate/Day</th>
                          {dates.map(date => (
                            <th key={date} colSpan={2} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b border-white/10 text-center border-r border-white/10">
                               {formatDateShort(date)}
                            </th>
                          ))}
                       </tr>
                       <tr className="bg-slate-800 text-slate-300">
                          {dates.flatMap(date => [
                             <th key={`in-${date}`} className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-center border-r border-white/10">In</th>,
                             <th key={`out-${date}`} className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-center border-r border-white/10">Out</th>
                          ])}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {workerRoster.map((worker, idx) => {
                         const signature = workerSignature(worker);
                         return (
                         <tr key={worker.id} className="hover:bg-slate-50 transition-all group">
                            <td className="px-6 py-4 text-[10px] font-bold text-slate-400 text-center border-r border-slate-50">{idx + 1}</td>
                            <td className="px-6 py-4">
                               <input
                                 type="text"
                                 value={worker.workerName}
                                 onChange={(e) => setWorkerRoster((prev) => prev.map((row) => row.id === worker.id ? { ...row, workerName: e.target.value } : row))}
                                 placeholder="Nama tenaga kerja"
                                 className="w-full bg-transparent text-xs font-black text-slate-900 uppercase italic leading-tight outline-none"
                               />
                            </td>
                            <td className="px-6 py-4 border-r border-slate-50">
                              <select
                                value={worker.workerType}
                                onChange={(e) => setWorkerRoster((prev) => prev.map((row) => row.id === worker.id ? { ...row, workerType: e.target.value as ProjectWorker['workerType'] } : row))}
                                className="w-full bg-transparent text-[9px] font-black text-slate-500 uppercase tracking-widest outline-none"
                              >
                                <option value="internal">Internal</option>
                                <option value="thl">THL</option>
                                <option value="borongan">Borongan</option>
                                <option value="subkon">Subkon</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 border-r border-slate-50">
                              <input
                                type="text"
                                value={worker.role}
                                onChange={(e) => setWorkerRoster((prev) => prev.map((row) => row.id === worker.id ? { ...row, role: e.target.value } : row))}
                                placeholder="Role / posisi"
                                className="w-full bg-transparent text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none outline-none"
                              />
                            </td>
                            <td className="px-3 py-4 border-r border-slate-50">
                              <input
                                type="number"
                                min="0"
                                value={worker.rate}
                                onChange={(e) => setWorkerRoster((prev) => prev.map((row) => row.id === worker.id ? { ...row, rate: Number(e.target.value || 0) } : row))}
                                className="w-24 bg-transparent text-[10px] font-black text-right text-slate-700 outline-none"
                              />
                            </td>
                            {dates.flatMap(date => [
                               <td key={`in-${worker.id}-${date}`} className="px-1 py-1 border-r border-slate-50">
                                  <input 
                                    type="text" 
                                    value={attendanceData[`${signature}-${date}-in`] || "07:00"}
                                    onChange={(e) => setAttendanceData({...attendanceData, [`${signature}-${date}-in`]: e.target.value})}
                                    className="w-full text-[10px] font-black text-center bg-transparent border-none outline-none focus:bg-blue-50 focus:text-blue-600 rounded transition-colors"
                                  />
                               </td>,
                               <td key={`out-${worker.id}-${date}`} className="px-1 py-1 border-r border-slate-50">
                                  <input 
                                    type="text" 
                                    value={attendanceData[`${signature}-${date}-out`] || "17:00"}
                                    onChange={(e) => setAttendanceData({...attendanceData, [`${signature}-${date}-out`]: e.target.value})}
                                    className="w-full text-[10px] font-black text-center bg-transparent border-none outline-none focus:bg-blue-50 focus:text-blue-600 rounded transition-colors"
                                  />
                               </td>
                            ])}
                         </tr>
                       )})}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : activeView === 'kasbon' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Kasbon Section */}
           {workerRoster.filter((worker) => String(worker.workerName || '').trim()).map((worker) => (
             <div key={worker.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black italic">
                         {String(worker.workerName || "?").charAt(0)}
                      </div>
                      <div>
                         <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">{worker.workerName}</h4>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{worker.role || worker.workerType}</p>
                      </div>
                   </div>
                   <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-right">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Total Kasbon</p>
                      <p className="text-sm font-black text-blue-600 italic">
                        {formatCurrency(
                          kasbonRows
                            .filter((row) => matchesWorkerKasbon(row, worker))
                            .reduce((sum, row) => sum + Number(row.amount || 0), 0)
                        )}
                      </p>
                   </div>
                </div>

                <div className="space-y-2">
                   <table className="w-full">
                      <thead>
                         <tr className="bg-slate-50 text-slate-400">
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-center w-12 rounded-l-xl">No</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest">Tanggal</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-right">Nominal (Rp)</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-center rounded-r-xl">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {kasbonRows
                          .filter((row) => matchesWorkerKasbon(row, worker))
                          .map((row, idx) => (
                            <tr key={row.id || `${worker.id}-${idx}`} className="group">
                              <td className="px-4 py-3 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                              <td className="px-4 py-3 text-xs font-black text-slate-900 uppercase italic">
                                {formatDateShort(String(row.date || new Date().toISOString().slice(0, 10)))}
                              </td>
                              <td className="px-4 py-3 text-xs font-black text-slate-900 text-right italic">
                                {formatCurrency(Number(row.amount || 0))}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-center">
                                  <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center">
                                    <CheckCircle2 size={14} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {kasbonRows.filter((row) => matchesWorkerKasbon(row, worker)).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-[10px] font-bold text-slate-300 uppercase italic">
                              Belum ada kasbon
                            </td>
                          </tr>
                        )}
                      </tbody>
                   </table>
                </div>

                   <button
                      onClick={() => handleAddKasbon(worker)}
                  className="mt-6 w-full py-3 bg-slate-50 text-slate-400 border border-slate-200 border-dashed rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
                >
                   <Plus size={14} /> Add New Entry
                </button>
             </div>
           ))}
        </div>
      ) : activeView === 'equipment' ? (
        getEquipmentView()
      ) : (
        getMaterialView()
      )}

      {/* Footer Info */}
      <div className="p-8 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
               <DollarSign size={28} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Site Commitment</p>
               <h3 className="text-xl font-black italic text-white tracking-tighter uppercase leading-none">PT GTP Project Excellence Ledger</h3>
            </div>
         </div>
         <div className="flex gap-4">
            <div className="text-center px-8 py-3 bg-white/5 rounded-2xl border border-white/10">
               <p className="text-lg font-black text-white italic leading-none">{formatCurrency(totalKasbonAmount)}</p>
               <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-widest">Aggregate Site Advances</p>
            </div>
            <button 
              onClick={handleFinalizeReport}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 hover:bg-blue-700 transition-all"
            >
               Finalize Weekly Report
            </button>
         </div>
      </div>

      {/* Finalize Report Modal */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinalizeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <FileDown size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Finalize Weekly Report</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audit-Ready Professional Export</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFinalizeModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Period</p>
                      <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">
                         {formatDateShort(dates[0])} - {formatDateShort(dates[dates.length-1])} 2026
                      </p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Personnel</p>
                      <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">
                         {workerRoster.filter((worker) => String(worker.workerName || '').trim()).length} Members
                      </p>
                   </div>
                   <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100/50">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Attendance Score</p>
                      <p className="text-sm font-black text-blue-600 uppercase italic leading-tight">
                         98.4% Compliance
                      </p>
                   </div>
                   <div className="p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Total Advances</p>
                      <p className="text-sm font-black text-emerald-600 uppercase italic leading-tight">
                         {formatCurrency(totalKasbonAmount)}
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Export Format</p>
                   <div className="flex gap-4">
                      <button 
                        onClick={() => handleExport('Word')}
                        className="flex-1 group relative overflow-hidden p-6 bg-slate-900 text-white rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText size={60} />
                         </div>
                         <div className="relative z-10 flex flex-col items-center gap-2">
                            <FileText size={32} className="text-blue-400" />
                            <span className="text-xs font-black uppercase italic tracking-widest">Microsoft Word</span>
                            <span className="text-[8px] opacity-40 uppercase font-bold tracking-widest">Professional Docx</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => handleExport('Excel')}
                        className="flex-1 group relative overflow-hidden p-6 bg-slate-50 text-slate-900 border border-slate-200 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FileSpreadsheet size={60} />
                         </div>
                         <div className="relative z-10 flex flex-col items-center gap-2">
                            <FileSpreadsheet size={32} className="text-emerald-500" />
                            <span className="text-xs font-black uppercase italic tracking-widest">Microsoft Excel</span>
                            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Financial Audit Xlsx</span>
                         </div>
                      </button>
                   </div>
                </div>

                <p className="text-[9px] text-slate-400 text-center font-bold uppercase italic leading-relaxed">
                   Export ini hanya menghasilkan dokumen weekly field report. Data attendance, kasbon, <br/>
                   equipment, dan material tetap mengikuti status yang sudah tersimpan di sistem.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Kasbon Input Modal */}
      <AnimatePresence>
        {showKasbonModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKasbonModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Input Kasbon</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Advances & Field Disbursements</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowKasbonModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={submitKasbon} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic">
                         {String(selectedWorker?.workerName || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Worker Name</p>
                      <p className="text-sm font-black text-slate-900 uppercase italic">{selectedWorker?.workerName}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tanggal Kasbon</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="date" 
                        required
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        value={kasbonDate}
                        onChange={(e) => setKasbonDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nominal (IDR)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="number" 
                        required
                        placeholder="e.g. 200000"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold uppercase italic outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        value={kasbonAmount}
                        onChange={(e) => setKasbonAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button 
                    type="button"
                    onClick={() => setShowKasbonModal(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                   >
                     Submit Advance
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Material Request Modal */}
      <AnimatePresence>
        {showMaterialModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMaterialModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Material Request</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Requesting from BOQ Ledger</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMaterialModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddMaterialRequest} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">BOQ Item Reference</label>
                  <select 
                    value={selectedBoqItemId}
                    onChange={(e) => setSelectedBoqItemId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
                    required
                  >
                    <option value="">Select BOQ Item...</option>
                    {(selectedProject?.boq || []).map((item: any) => (
                      <option key={item.id} value={item.id}>{item.itemDescription} ({item.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Req. Quantity</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={requestQty}
                      onChange={(e) => setRequestQty(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. 100"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Date</label>
                    <input 
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all transform active:scale-95"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Equipment Usage Modal */}
      <AnimatePresence>
        {showEquipmentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEquipmentModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Log Equipment</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Machine Hours & Asset Utilization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEquipmentModal(false)}
                  className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEquipmentUsage} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Machine / Asset</label>
                  <select 
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase italic outline-none focus:border-blue-500 transition-all appearance-none"
                    required
                  >
                    <option value="">Choose Asset...</option>
                    {effectiveAssetList.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetCode})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date</label>
                    <input 
                      type="date"
                      value={usageDate}
                      onChange={(e) => setUsageDate(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hours Used</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={usageHours}
                      onChange={(e) => setUsageHours(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black italic outline-none focus:border-blue-500 transition-all"
                      placeholder="e.g. 8"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all transform active:scale-95"
                  >
                    Confirm Usage Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
