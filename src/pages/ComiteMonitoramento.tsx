/**
 * Página de Monitoramento de Comitê
 * Exibe agenda, reuniões, quadro de controle e informações do comitê
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isDomainRoot } from '@/utils/domain';
import { areasApi, Area } from '@/services/areasApi';
import { comitesApi, membrosApi, reunioesApi, pautaApi, quadroControleApi, atasApi } from '@/services/comitesApi';
import type {
    Comite,
    ComiteMembro,
    ComiteReuniao,
    ComiteReuniaoPauta,
    ComiteQuadroControle,
    ReuniaoStatus,
    TipoReuniao,
    QuadroControleStatus
} from '@/types';
import {
    Calendar,
    Home,
    Menu,
    Building2,
    Search,
    FileText,
    Plus,
    Pencil,
    Trash2,
    Check,
    AlertCircle,
    ExternalLink,
    ChevronLeft,
    Users,
    ClipboardList,
    Info,
    X,
    Upload,
    File
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Meses para select
const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export default function ComiteMonitoramento() {
    const { sigla } = useParams<{ sigla: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    // Estado principal
    const [comite, setComite] = useState<Comite | null>(null);
    const [reunioes, setReunioes] = useState<ComiteReuniao[]>([]);
    const [membros, setMembros] = useState<ComiteMembro[]>([]);
    const [quadroControle, setQuadroControle] = useState<ComiteQuadroControle[]>([]);
    const [reuniaoAtiva, setReuniaoAtiva] = useState<ComiteReuniao | null>(null);
    const [pauta, setPauta] = useState<ComiteReuniaoPauta[]>([]);
    const [todasReunioes, setTodasReunioes] = useState<ComiteReuniao[]>([]); // Todas as reuniões para o select do Controle de Ações

    // Estado de loading
    const [loading, setLoading] = useState(true);
    const [loadingPauta, setLoadingPauta] = useState(false);

    // Estado de UI
    const [abaAtiva, setAbaAtiva] = useState('reunioes');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

    // Estado de modais
    const [modalPauta, setModalPauta] = useState<{ open: boolean; item: ComiteReuniaoPauta | null }>({ open: false, item: null });
    const [modalQuadro, setModalQuadro] = useState<{ open: boolean; item: ComiteQuadroControle | null }>({ open: false, item: null });
    const [modalMembro, setModalMembro] = useState<{ open: boolean; item: ComiteMembro | null }>({ open: false, item: null });
    const [modalDescricao, setModalDescricao] = useState(false);
    const [modalReuniao, setModalReuniao] = useState<{ open: boolean; item: ComiteReuniao | null }>({ open: false, item: null });
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; title?: string } | null>(null);

    // Carregar áreas para isDomainRoot
    const [domainAreas, setDomainAreas] = useState<Area[]>([]);
    useEffect(() => {
        areasApi.getAll().then(setDomainAreas).catch(console.error);
    }, []);

    // SGJT tem acesso total aos comitês independente do role
    // Demais diretorias precisam de MANAGER ou ADMIN E ser domain root
    const isRoot = isDomainRoot(user, domainAreas);
    const isSgjt = (user as any)?.diretoria === 'SGJT';
    const isGestorOrAdmin = isSgjt || ((user?.role === 'MANAGER' || user?.role === 'ADMIN') && isRoot);

    // Carregar dados iniciais
    useEffect(() => {
        if (sigla) {
            loadComite();
        }
    }, [sigla, anoFiltro]);

    // Carregar pauta quando reunião ativa muda
    useEffect(() => {
        if (reuniaoAtiva && comite) {
            loadPauta(reuniaoAtiva.id);
        }
    }, [reuniaoAtiva?.id, comite?.id]);

    const loadComite = async () => {
        try {
            setLoading(true);
            const comiteData = await comitesApi.getBySigla(sigla!);
            setComite(comiteData);

            // Carregar dados relacionados em paralelo
            const [reunioesData, membrosData, quadroData, todasReunioesData] = await Promise.all([
                reunioesApi.getByComite(comiteData.id, anoFiltro),
                membrosApi.getByComite(comiteData.id),
                quadroControleApi.getByComite(comiteData.id),
                reunioesApi.getByComite(comiteData.id) // Todas as reuniões (sem filtro de ano)
            ]);

            setReunioes(reunioesData);
            setMembros(membrosData);
            setQuadroControle(quadroData);
            setTodasReunioes(todasReunioesData);

            // Selecionar a reunião mais recente ou a última prevista (apenas do ano filtrado)
            if (reunioesData.length > 0) {
                const hoje = new Date();
                const reuniaoHoje = reunioesData.find(r => {
                    const dataReuniao = new Date(r.data);
                    return dataReuniao.toDateString() === hoje.toDateString();
                });

                if (reuniaoHoje) {
                    setReuniaoAtiva(reuniaoHoje);
                } else {
                    // Última reunião realizada ou primeira prevista
                    const realizadas = reunioesData.filter(r => r.status === 'Realizada');
                    const previstas = reunioesData.filter(r => r.status === 'Previsto');
                    setReuniaoAtiva(realizadas[realizadas.length - 1] || previstas[0] || reunioesData[0]);
                }
            } else {
                // Se não há reuniões no ano filtrado, limpar a reunião ativa
                setReuniaoAtiva(null);
            }
        } catch (err: any) {
            console.error('Erro ao carregar comitê:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPauta = async (reuniaoId: number) => {
        if (!comite) return;
        try {
            setLoadingPauta(true);
            const pautaData = await pautaApi.getByReuniao(comite.id, reuniaoId);
            setPauta(pautaData);
        } catch (err) {
            console.error('Erro ao carregar pauta:', err);
        } finally {
            setLoadingPauta(false);
        }
    };

    // Formatar data
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    // ============================================================
    // HANDLERS DE REUNIÕES
    // ============================================================

    const handleSaveReuniao = async (data: any, ataFile?: File | null, removeAta?: boolean) => {
        if (!comite || !sigla) return;

        try {
            const titulo = `Reunião ${data.numero} - ${data.ano}`;
            const payload = { ...data, titulo };

            let reuniaoId: number;
            let updatedReuniao: ComiteReuniao;

            if (modalReuniao.item) {
                // Editar
                updatedReuniao = await reunioesApi.update(comite.id, modalReuniao.item.id, payload);
                reuniaoId = updatedReuniao.id;

                // Processar upload de ata
                if (ataFile) {
                    try {
                        await atasApi.upload(sigla, reuniaoId, ataFile, data.numero, data.ano);
                        // Recarregar reunião para pegar dados da ata
                        updatedReuniao = await reunioesApi.getById(comite.id, reuniaoId);
                        
                    } catch (uploadErr: any) {
                    }
                } else if (removeAta) {
                    try {
                        await atasApi.delete(sigla, reuniaoId);
                        // Recarregar reunião
                        updatedReuniao = await reunioesApi.getById(comite.id, reuniaoId);
                        
                    } catch (deleteErr: any) {
                    }
                } else {
                    
                }

                setReunioes(prev =>
                    prev.map(r => r.id === updatedReuniao.id ? updatedReuniao : r)
                        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                );
                if (reuniaoAtiva?.id === updatedReuniao.id) {
                    setReuniaoAtiva(updatedReuniao);
                }
            } else {
                // Criar
                updatedReuniao = await reunioesApi.create(comite.id, payload);
                reuniaoId = updatedReuniao.id;

                // Processar upload de ata para nova reunião
                if (ataFile) {
                    try {
                        await atasApi.upload(sigla, reuniaoId, ataFile, data.numero, data.ano);
                        // Recarregar reunião
                        updatedReuniao = await reunioesApi.getById(comite.id, reuniaoId);
                        
                    } catch (uploadErr: any) {
                    }
                } else {
                    
                }

                setReunioes(prev =>
                    [...prev, updatedReuniao].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                );
            }
            setModalReuniao({ open: false, item: null });
        } catch (err: any) {
            if (err.status === 409) {
            } else {
            }
        }
    };

    const handleDeleteReuniao = async (id: number) => {
        if (!comite) return;

        try {
            await reunioesApi.delete(comite.id, id);
            setReunioes(prev => prev.filter(r => r.id !== id));

            // Se era a reunião ativa, selecionar outra
            if (reuniaoAtiva?.id === id) {
                const proxima = reunioes.find(r => r.id !== id);
                setReuniaoAtiva(proxima || null);
            }

            
        } catch (err: any) {
        }
        setDeleteConfirm(null);
    };

    // ============================================================
    // HANDLERS DE PAUTA
    // ============================================================

    const handleSavePauta = async (data: { numero_item: number; descricao: string }) => {
        if (!comite || !reuniaoAtiva) return;

        try {
            if (modalPauta.item) {
                const updated = await pautaApi.update(comite.id, reuniaoAtiva.id, modalPauta.item.id, data);
                setPauta(prev => prev.map(p => p.id === updated.id ? updated : p));
                
            } else {
                const created = await pautaApi.create(comite.id, reuniaoAtiva.id, data);
                setPauta(prev => [...prev, created].sort((a, b) => a.numero_item - b.numero_item));
                
            }
            setModalPauta({ open: false, item: null });
        } catch (err: any) {
        }
    };

    const handleDeletePauta = async (id: number) => {
        if (!comite || !reuniaoAtiva) return;

        try {
            await pautaApi.delete(comite.id, reuniaoAtiva.id, id);
            setPauta(prev => prev.filter(p => p.id !== id));
            
        } catch (err: any) {
        }
        setDeleteConfirm(null);
    };

    // ============================================================
    // HANDLERS DE QUADRO DE CONTROLE
    // ============================================================

    const handleSaveQuadro = async (data: Partial<ComiteQuadroControle>) => {
        if (!comite) {
            toast({ title: 'Erro', description: 'Comitê não carregado', variant: 'destructive' });
            return;
        }

        try {
            console.log('🔄 Salvando quadro controle:', { comiteId: comite.id, itemId: modalQuadro.item?.id, data });

            if (modalQuadro.item) {
                // Editar
                const updated = await quadroControleApi.update(comite.id, modalQuadro.item.id, data);
                console.log('✅ Quadro atualizado:', updated);
                setQuadroControle(prev => prev.map(q => q.id === updated.id ? updated : q));
                
            } else {
                // Criar
                const created = await quadroControleApi.create(comite.id, data as any);
                console.log('✅ Quadro criado:', created);
                setQuadroControle(prev => [...prev, created]);
                
            }
            setModalQuadro({ open: false, item: null });
        } catch (err: any) {
            console.error('❌ Erro ao salvar quadro:', err);
        }
    };

    const handleDeleteQuadro = async (id: number) => {
        if (!comite) return;

        try {
            await quadroControleApi.delete(comite.id, id);
            setQuadroControle(prev => prev.filter(q => q.id !== id));
            
        } catch (err: any) {
        }
        setDeleteConfirm(null);
    };

    // ============================================================
    // HANDLERS DE MEMBROS
    // ============================================================

    const handleSaveMembro = async (data: { nome: string; cargo: string }) => {
        if (!comite) return;

        try {
            if (modalMembro.item) {
                const updated = await membrosApi.update(comite.id, modalMembro.item.id, data);
                setMembros(prev => prev.map(m => m.id === updated.id ? updated : m));
                
            } else {
                const created = await membrosApi.create(comite.id, data);
                setMembros(prev => [...prev, created]);
                
            }
            setModalMembro({ open: false, item: null });
        } catch (err: any) {
        }
    };

    const handleDeleteMembro = async (id: number) => {
        if (!comite) return;

        try {
            await membrosApi.delete(comite.id, id);
            setMembros(prev => prev.filter(m => m.id !== id));
            
        } catch (err: any) {
        }
        setDeleteConfirm(null);
    };

    // ============================================================
    // HANDLER DE DESCRIÇÃO
    // ============================================================

    const handleSaveDescricao = async (descricao: string) => {
        if (!comite) return;

        try {
            const updated = await comitesApi.update(comite.id, { descricao });
            setComite(updated);
            
            setModalDescricao(false);
        } catch (err: any) {
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <Layout>
                <div className="flex h-screen">
                    <Skeleton className="w-80 h-full" />
                    <div className="flex-1 p-6">
                        <Skeleton className="h-12 w-96 mb-6" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </Layout>
        );
    }

    if (!comite) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Comitê não encontrado</h2>
                        <Button onClick={() => navigate('/comites')}>
                            Voltar para Comitês
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="flex h-[calc(100vh-73px)]">
                {/* ============================================================ */}
                {/* SIDEBAR - AGENDA (Layout Compacto em Tabela) */}
                {/* ============================================================ */}
                <aside
                    className={cn(
                        "flex-shrink-0 bg-[#003766] text-white overflow-hidden transition-all duration-300",
                        sidebarOpen ? "w-[260px]" : "w-0"
                    )}
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(255,255,255,0.3) transparent'
                    }}
                >
                    <div className="h-full overflow-y-auto p-3">
                        {/* Header da Agenda */}
                        <div className="flex items-center justify-between mb-4 p-3 bg-black/15 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-6 w-6" />
                                <span className="font-bold text-lg">Agenda</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-white hover:bg-white/20 lg:hidden h-7 w-7 p-0"
                                onClick={() => setSidebarOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Filtro de Ano */}
                        <div className="mb-4">
                            <Select
                                value={anoFiltro.toString()}
                                onValueChange={(v) => setAnoFiltro(parseInt(v))}
                            >
                                <SelectTrigger className="bg-white/10 border-white/30 text-white hover:bg-white/15 focus:ring-white/30">
                                    <SelectValue placeholder="Selecione o ano" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: new Date().getFullYear() - 2024 }, (_, i) => 2025 + i).map(ano => (
                                        <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Botão Nova Reunião (gestor/admin) */}
                        {isGestorOrAdmin && (
                            <Button
                                className="w-full mb-4 bg-white/12 hover:bg-white/22 border-2 border-dashed border-white/40 hover:border-white/70 text-white font-bold uppercase tracking-wide text-xs py-2.5 transition-all"
                                onClick={() => setModalReuniao({ open: true, item: null })}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Reunião
                            </Button>
                        )}

                        {/* Tabela de Reuniões */}
                        {reunioes.length === 0 ? (
                            <div className="text-center py-8 text-white/70">
                                <p className="text-sm">Nenhuma reunião cadastrada</p>
                                {isGestorOrAdmin && (
                                    <p className="text-xs mt-2 text-white/50 italic">
                                        Clique em "Nova Reunião" para adicionar
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                {/* Header da Tabela */}
                                <div className="grid grid-cols-[1fr_75px_32px] gap-2 px-2 py-2.5 bg-black/15 rounded-t-md border-b-2 border-white/20 text-xs font-bold text-white/95 uppercase tracking-wide">
                                    <span>Reunião</span>
                                    <span>Data</span>
                                    <span></span>
                                </div>

                                {/* Linhas das Reuniões */}
                                <div className="space-y-0.5">
                                    {reunioes.map((reuniao) => (
                                        <div
                                            key={reuniao.id}
                                        >
                                            {/* Linha da Reunião */}
                                            <div
                                                onClick={() => {
                                                    setReuniaoAtiva(reuniao);
                                                    setAbaAtiva('reunioes');
                                                }}
                                                className={cn(
                                                    "grid grid-cols-[1fr_75px_32px] gap-2 px-2 py-2.5 rounded-md cursor-pointer transition-all duration-200 border-2 border-transparent items-center",
                                                    reuniaoAtiva?.id === reuniao.id
                                                        ? "bg-white/20 border-l-4 border-l-white shadow-md font-semibold"
                                                        : "bg-white/6 hover:bg-white/12 hover:translate-x-1 hover:border-white/25"
                                                )}
                                            >
                                                {/* Coluna: Reunião */}
                                                <span className="text-xs font-medium whitespace-nowrap flex items-center gap-1">
                                                    Reunião {reuniao.numero}
                                                    {reuniao.tipo_reuniao === 'Extraordinária' && (
                                                        <span className="bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded leading-none">
                                                            EXT
                                                        </span>
                                                    )}
                                                </span>

                                                {/* Coluna: Data */}
                                                <span className="text-xs font-medium text-white/70">
                                                    {formatDate(reuniao.data)}
                                                </span>

                                                {/* Coluna: Status */}
                                                <span className="flex items-center justify-center">
                                                    {reuniao.status === 'Realizada' && (
                                                        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                    {reuniao.status === 'Previsto' && (
                                                        <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                    {reuniao.status === 'Cancelada' && (
                                                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </span>
                                                    )}
                                                </span>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* ============================================================ */}
                {/* CONTEÚDO PRINCIPAL */}
                {/* ============================================================ */}
                <main className="flex-1 overflow-y-auto bg-slate-50">
                    {/* Header */}
                    <div className="bg-white border-b px-6 py-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/comites')}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Voltar
                            </Button>
                            <div className="flex-1">
                                <h1 className="text-xl font-bold text-[#1565C0]">
                                    {comite.nome}
                                </h1>
                                <span className="text-sm text-slate-500">({comite.sigla})</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/')}
                            >
                                <Home className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-6 pt-4">
                        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
                            <div className="flex items-center gap-3">
                                <TabsList className="bg-white border">
                                    <TabsTrigger value="reunioes" className="gap-2">
                                        <ClipboardList className="h-4 w-4" />
                                        Reuniões
                                    </TabsTrigger>
                                    <TabsTrigger value="quadro-controle" className="gap-2">
                                        <FileText className="h-4 w-4" />
                                        Controle de Ações
                                    </TabsTrigger>
                                    <TabsTrigger value="sobre" className="gap-2">
                                        <Info className="h-4 w-4" />
                                        Sobre o Comitê
                                    </TabsTrigger>
                                </TabsList>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50"
                                    onClick={() => {
                                        const link = reunioes.find(r => r.link_proad)?.link_proad || 'https://portaltj.tjgo.jus.br/sistemas/index.php?s=corporativo&mensagem=ausencia_cookies_proad';
                                        window.open(link, '_blank');
                                    }}
                                >
                                    <Building2 className="h-4 w-4" />
                                    Proad
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </div>

                            {/* ======================================== */}
                            {/* ABA: REUNIÕES */}
                            {/* ======================================== */}
                            <TabsContent value="reunioes" className="mt-6">
                                {reuniaoAtiva ? (
                                    <div className="space-y-6">
                                        {/* Header da Reunião */}
                                        <div className="bg-slate-100 rounded-lg p-4 border-b-4 border-[#1565C0]">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h2 className="text-xl font-bold text-[#1565C0]">
                                                        {reuniaoAtiva.titulo || `Reunião ${reuniaoAtiva.numero} - ${reuniaoAtiva.ano}`}
                                                    </h2>
                                                    <p className="text-slate-600">
                                                        Data da Reunião: {formatDate(reuniaoAtiva.data)}
                                                    </p>
                                                </div>
                                                {isGestorOrAdmin && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 border-[#1565C0] text-[#1565C0] hover:bg-[#1565C0] hover:text-white"
                                                            onClick={() => setModalReuniao({ open: true, item: reuniaoAtiva })}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Editar Reunião
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                                            onClick={() => setDeleteConfirm({
                                                                type: 'reuniao',
                                                                id: reuniaoAtiva.id,
                                                                title: reuniaoAtiva.titulo || `Reunião ${reuniaoAtiva.numero} - ${reuniaoAtiva.ano}`
                                                            })}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Excluir
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Botões de Links */}
                                        <div className="flex flex-wrap gap-4">

                                            {reuniaoAtiva.link_transparencia && (
                                                <Button
                                                    variant="secondary"
                                                    className="bg-slate-600 hover:bg-slate-700 text-white gap-2"
                                                    onClick={() => window.open(reuniaoAtiva.link_transparencia!, '_blank')}
                                                >
                                                    <Search className="h-4 w-4" />
                                                    Transparência
                                                    <ExternalLink className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {/* Botão Ata de Reunião - PDF ou Link externo */}
                                            {(reuniaoAtiva.ata_filename || reuniaoAtiva.link_ata) ? (
                                                <Button
                                                    variant="secondary"
                                                    className="bg-slate-600 hover:bg-slate-700 text-white gap-2 relative"
                                                    onClick={() => {
                                                        if (reuniaoAtiva.ata_filename && sigla) {
                                                            // Se tem PDF, abrir PDF
                                                            window.open(atasApi.getDownloadUrl(sigla, reuniaoAtiva.id), '_blank');
                                                        } else if (reuniaoAtiva.link_ata) {
                                                            // Se tem apenas link externo
                                                            window.open(reuniaoAtiva.link_ata, '_blank');
                                                        }
                                                    }}
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    Ata de Reunião
                                                    <ExternalLink className="h-3 w-3" />
                                                    {/* Badge de disponibilidade */}
                                                    <span className="absolute -top-1 -right-1 bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow">
                                                        ✓
                                                    </span>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    className="bg-slate-400 text-white gap-2 cursor-not-allowed opacity-60"
                                                    disabled
                                                    title="Ata ainda não disponível"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    Ata de Reunião
                                                </Button>
                                            )}
                                        </div>

                                        {/* Seção Pauta */}
                                        <Card className="overflow-hidden">
                                            <div className="flex">
                                                {/* Barra lateral azul */}
                                                <div className="w-12 bg-[#0D47A1] flex flex-col items-center justify-center py-4">
                                                    <span
                                                        className="text-white font-bold text-sm tracking-widest"
                                                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                    >
                                                        PAUTA
                                                    </span>
                                                </div>

                                                {/* Conteúdo da pauta */}
                                                <div className="flex-1 p-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="font-semibold text-slate-700">Itens da Pauta</h3>
                                                        {isGestorOrAdmin && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-1 border-dashed border-[#1565C0] text-[#1565C0] hover:bg-blue-50"
                                                                onClick={() => setModalPauta({ open: true, item: null })}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                                Adicionar Item
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {loadingPauta ? (
                                                        <div className="space-y-2">
                                                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                                                        </div>
                                                    ) : pauta.length === 0 ? (
                                                        <p className="text-slate-500 text-center py-8">
                                                            Nenhum item na pauta desta reunião.
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {pauta.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className={cn(
                                                                        "p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors",
                                                                        isGestorOrAdmin && "group"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <span className="flex-shrink-0 bg-[#1565C0] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                                                            {item.numero_item}
                                                                        </span>
                                                                        <p className="flex-1 text-slate-700">{item.descricao}</p>
                                                                        {isGestorOrAdmin && (
                                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-7 w-7 p-0"
                                                                                    onClick={() => setModalPauta({ open: true, item })}
                                                                                >
                                                                                    <Pencil className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                                                    onClick={() => setDeleteConfirm({ type: 'pauta', id: item.id })}
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>

                                        {/* Observações */}
                                        {reuniaoAtiva.observacoes && (
                                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                                <p className="text-slate-700">
                                                    <span className="font-semibold">Observações:</span> {reuniaoAtiva.observacoes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        {reunioes.length === 0
                                            ? "Nenhuma reunião cadastrada. Use o botão 'Nova Reunião' na agenda."
                                            : "Selecione uma reunião na agenda para ver os detalhes."
                                        }
                                    </div>
                                )}
                            </TabsContent>

                            {/* ======================================== */}
                            {/* ABA: QUADRO DE CONTROLE */}
                            {/* ======================================== */}
                            <TabsContent value="quadro-controle" className="mt-6">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Controle de Ações</CardTitle>
                                        {isGestorOrAdmin && (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 gap-1"
                                                onClick={() => setModalQuadro({ open: true, item: null })}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Nova Ação
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-[#1565C0] hover:bg-[#1565C0]">
                                                        <TableHead className="text-white font-bold">Ação</TableHead>
                                                        <TableHead className="text-white font-bold">ID Reunião</TableHead>
                                                        <TableHead className="text-white font-bold">Item da Pauta</TableHead>
                                                        <TableHead className="text-white font-bold">Responsáveis</TableHead>
                                                        <TableHead className="text-white font-bold">Prazo</TableHead>
                                                        <TableHead className="text-white font-bold">Status</TableHead>
                                                        {isGestorOrAdmin && (
                                                            <TableHead className="text-white font-bold w-20">Ações</TableHead>
                                                        )}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {quadroControle.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={isGestorOrAdmin ? 7 : 6} className="text-center py-8 text-slate-500">
                                                                Nenhuma ação cadastrada.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        quadroControle.map((item) => (
                                                            <TableRow key={item.id} className="hover:bg-slate-50">
                                                                <TableCell className="font-medium min-w-[200px] max-w-[300px]">
                                                                    {item.item}
                                                                </TableCell>
                                                                <TableCell className="min-w-[130px]">
                                                                    {item.reuniao_numero ? (
                                                                        <span className="text-sm">
                                                                            Reunião {item.reuniao_numero}/{item.reuniao_ano}
                                                                            {item.reuniao_data && (
                                                                                <span className="block text-xs text-slate-500">
                                                                                    {new Date(item.reuniao_data).toLocaleDateString('pt-BR')}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="min-w-[150px] max-w-[250px]">
                                                                    {item.item_pauta_numero ? (
                                                                        <span className="text-sm">
                                                                            {item.item_pauta_descricao && (
                                                                                <span className="block text-xs text-slate-500 truncate" title={item.item_pauta_descricao}>
                                                                                    {item.item_pauta_descricao}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>{item.responsavel || <span className="text-slate-400">-</span>}</TableCell>
                                                                <TableCell className="min-w-[100px]">
                                                                    {item.prazo ? (
                                                                        <span className={cn(
                                                                            "text-sm",
                                                                            new Date(item.prazo) < new Date() && item.status !== 'Concluída' && "text-red-600 font-medium"
                                                                        )}>
                                                                            {new Date(item.prazo).toLocaleDateString('pt-BR')}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {isGestorOrAdmin ? (
                                                                        <Select
                                                                            value={item.status}
                                                                            onValueChange={async (newStatus) => {
                                                                                if (!comite) return;
                                                                                try {
                                                                                    const updated = await quadroControleApi.update(comite.id, item.id, { status: newStatus as QuadroControleStatus });
                                                                                    setQuadroControle(prev => prev.map(q => q.id === updated.id ? updated : q));
                                                                                    
                                                                                } catch (err: any) {
                                                                                }
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className={cn(
                                                                                "h-8 w-32",
                                                                                item.status === 'Concluída' && "bg-green-100 text-green-700 border-green-300",
                                                                                item.status === 'Andamento' && "bg-amber-100 text-amber-700 border-amber-300",
                                                                                item.status === 'Cancelada' && "bg-red-100 text-red-700 border-red-300"
                                                                            )}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="Andamento">Andamento</SelectItem>
                                                                                <SelectItem value="Concluída">Concluída</SelectItem>
                                                                                <SelectItem value="Cancelada">Cancelada</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={cn(
                                                                                item.status === 'Concluída' && "bg-green-100 text-green-700 border-green-300",
                                                                                item.status === 'Andamento' && "bg-amber-100 text-amber-700 border-amber-300",
                                                                                item.status === 'Cancelada' && "bg-red-100 text-red-700 border-red-300 line-through"
                                                                            )}
                                                                        >
                                                                            {item.status === 'Concluída' && <Check className="h-3 w-3 mr-1" />}
                                                                            {item.status}
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                {isGestorOrAdmin && (
                                                                    <TableCell>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-7 w-7 p-0"
                                                                                onClick={() => setModalQuadro({ open: true, item })}
                                                                            >
                                                                                <Pencil className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                                                onClick={() => setDeleteConfirm({ type: 'quadro', id: item.id })}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* ======================================== */}
                            {/* ABA: SOBRE O COMITÊ */}
                            {/* ======================================== */}
                            <TabsContent value="sobre" className="mt-6 space-y-6">
                                {/* Descrição */}
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Sobre o Comitê</CardTitle>
                                        {isGestorOrAdmin && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1"
                                                onClick={() => setModalDescricao(true)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                                Editar Descrição
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-slate-700 leading-relaxed text-justify whitespace-pre-line">
                                            {comite.descricao || 'Nenhuma descrição disponível.'}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Membros */}
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            Composição do Comitê
                                        </CardTitle>
                                        {isGestorOrAdmin && (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 gap-1"
                                                onClick={() => setModalMembro({ open: true, item: null })}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Adicionar Membro
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#1565C0] hover:bg-[#1565C0]">
                                                    <TableHead className="text-white font-bold">Integrante</TableHead>
                                                    <TableHead className="text-white font-bold">Cargo</TableHead>
                                                    {isGestorOrAdmin && (
                                                        <TableHead className="text-white font-bold w-20">Ações</TableHead>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {membros.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={isGestorOrAdmin ? 3 : 2} className="text-center py-8 text-slate-500">
                                                            Nenhum membro cadastrado.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    membros.map((membro) => (
                                                        <TableRow key={membro.id} className="hover:bg-slate-50">
                                                            <TableCell className="font-semibold">{membro.nome}</TableCell>
                                                            <TableCell className="text-slate-600">{membro.cargo}</TableCell>
                                                            {isGestorOrAdmin && (
                                                                <TableCell>
                                                                    <div className="flex gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 p-0"
                                                                            onClick={() => setModalMembro({ open: true, item: membro })}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                                            onClick={() => setDeleteConfirm({ type: 'membro', id: membro.id })}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </main>
            </div>

            {/* ============================================================ */}
            {/* MODAIS */}
            {/* ============================================================ */}

            {/* Modal Reunião */}
            <ModalReuniao
                open={modalReuniao.open}
                item={modalReuniao.item}
                sigla={sigla || ''}
                anoFiltro={anoFiltro}
                reunioes={reunioes}
                onClose={() => setModalReuniao({ open: false, item: null })}
                onSave={handleSaveReuniao}
            />

            {/* Modal Pauta */}
            <ModalPauta
                open={modalPauta.open}
                item={modalPauta.item}
                onClose={() => setModalPauta({ open: false, item: null })}
                onSave={handleSavePauta}
            />

            {/* Modal Controle de Ações */}
            <ModalQuadroControle
                open={modalQuadro.open}
                item={modalQuadro.item}
                reunioes={todasReunioes}
                onClose={() => setModalQuadro({ open: false, item: null })}
                onSave={handleSaveQuadro}
                onLoadPauta={async (reuniaoId: number) => {
                    if (!comite) return [];
                    try {
                        return await pautaApi.getByReuniao(comite.id, reuniaoId);
                    } catch (err) {
                        console.error('Erro ao carregar pauta:', err);
                        return [];
                    }
                }}
            />

            {/* Modal Membro */}
            <ModalMembro
                open={modalMembro.open}
                item={modalMembro.item}
                onClose={() => setModalMembro({ open: false, item: null })}
                onSave={handleSaveMembro}
            />

            {/* Modal Descrição */}
            <ModalDescricao
                open={modalDescricao}
                descricao={comite?.descricao || ''}
                onClose={() => setModalDescricao(false)}
                onSave={handleSaveDescricao}
            />

            {/* Diálogo de Confirmação de Exclusão */}
            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>⚠️ Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfirm?.type === 'reuniao' ? (
                                <>
                                    Tem certeza que deseja excluir a reunião:
                                    <br /><br />
                                    <strong>"{deleteConfirm.title}"</strong>
                                    <br /><br />
                                    Esta ação irá excluir também todos os itens da pauta desta reunião.
                                    <br />
                                    <span className="text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                                </>
                            ) : (
                                <>
                                    Tem certeza que deseja excluir este item?
                                    <br />
                                    <span className="text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                if (deleteConfirm?.type === 'reuniao') handleDeleteReuniao(deleteConfirm.id);
                                if (deleteConfirm?.type === 'pauta') handleDeletePauta(deleteConfirm.id);
                                if (deleteConfirm?.type === 'quadro') handleDeleteQuadro(deleteConfirm.id);
                                if (deleteConfirm?.type === 'membro') handleDeleteMembro(deleteConfirm.id);
                            }}
                        >
                            Sim, Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Layout>
    );
}

// ============================================================
// COMPONENTES DE MODAL
// ============================================================

interface ModalReuniaoProps {
    open: boolean;
    item: ComiteReuniao | null;
    sigla: string;
    anoFiltro: number;
    reunioes: ComiteReuniao[];
    onClose: () => void;
    onSave: (data: any, ataFile?: File | null, removeAta?: boolean) => void;
}

function ModalReuniao({ open, item, sigla, anoFiltro, reunioes, onClose, onSave }: ModalReuniaoProps) {
    const [formData, setFormData] = useState({
        numero: '',
        ano: anoFiltro.toString(),
        data: '',
        mes: '',
        status: 'Previsto' as ReuniaoStatus,
        tipo_reuniao: 'Ordinária' as TipoReuniao,
        link_proad: 'https://portaltj.tjgo.jus.br/sistemas/index.php?s=corporativo&mensagem=ausencia_cookies_proad',
        link_transparencia: 'https://www.tjgo.jus.br/index.php/comissoes-comites/comites/comite-gestor-de-tecnologia-da-informacao-e-comunicacao-cgtic',
        link_ata: '',
        observacoes: ''
    });

    // Estado para upload de ata
    const [ataFile, setAtaFile] = useState<File | null>(null);
    const [removeAta, setRemoveAta] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (open) {
            setAtaFile(null);
            setRemoveAta(false);
            setUploadError('');
            setValidationError('');

            if (item) {
                setFormData({
                    numero: item.numero.toString(),
                    ano: item.ano.toString(),
                    data: item.data.split('T')[0],
                    mes: item.mes || '',
                    status: item.status,
                    tipo_reuniao: (item.tipo_reuniao || 'Ordinária') as TipoReuniao,
                    link_proad: item.link_proad || '',
                    link_transparencia: item.link_transparencia || '',
                    link_ata: item.link_ata || '',
                    observacoes: item.observacoes || ''
                });
            } else {
                // Auto-calcular próximo número da reunião
                const maxNumero = reunioes.length > 0
                    ? Math.max(...reunioes.map(r => r.numero))
                    : 0;
                setFormData({
                    numero: (maxNumero + 1).toString(),
                    ano: anoFiltro.toString(),
                    data: '',
                    mes: '',
                    status: 'Previsto',
                    tipo_reuniao: 'Ordinária',
                    link_proad: 'https://portaltj.tjgo.jus.br/sistemas/index.php?s=corporativo&mensagem=ausencia_cookies_proad',
                    link_transparencia: 'https://www.tjgo.jus.br/index.php/comissoes-comites/comites/comite-gestor-de-tecnologia-da-informacao-e-comunicacao-cgtic',
                    link_ata: '',
                    observacoes: ''
                });
            }
        }
    }, [open, item, anoFiltro, reunioes]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo
        if (file.type !== 'application/pdf') {
            setUploadError('Apenas arquivos PDF são permitidos');
            return;
        }

        // Validar tamanho (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('Arquivo muito grande. Máximo: 10MB');
            return;
        }

        setUploadError('');
        setAtaFile(file);
        setRemoveAta(false);
    };

    const handleRemoveAta = () => {
        setAtaFile(null);
        setRemoveAta(true);
        setUploadError('');
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError('');

        // Validar campos obrigatórios
        if (!formData.numero) {
            setValidationError('Preencha o número da reunião');
            return;
        }
        if (!formData.ano) {
            setValidationError('Preencha o ano');
            return;
        }
        if (!formData.data) {
            setValidationError('Selecione a data da reunião');
            return;
        }
        if (!formData.mes) {
            setValidationError('Selecione o mês');
            return;
        }

        onSave({
            numero: parseInt(formData.numero),
            ano: parseInt(formData.ano),
            data: formData.data,
            mes: formData.mes,
            status: formData.status,
            tipo_reuniao: formData.tipo_reuniao,
            link_proad: formData.link_proad || null,
            link_transparencia: formData.link_transparencia || null,
            link_ata: formData.link_ata || null,
            observacoes: formData.observacoes || null
        }, ataFile, removeAta);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? `Editar Reunião ${item.numero} - ${item.ano}` : 'Adicionar Nova Reunião'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium">Número da Reunião *</label>
                            <Input
                                type="number"
                                value={formData.numero}
                                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                                placeholder="22"
                                min={1}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Ano *</label>
                            <Input
                                type="number"
                                value={formData.ano}
                                disabled
                                className="bg-gray-100 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Tipo *</label>
                            <Select
                                value={formData.tipo_reuniao}
                                onValueChange={(v) => setFormData({ ...formData, tipo_reuniao: v as TipoReuniao })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Ordinária">Ordinária</SelectItem>
                                    <SelectItem value="Extraordinária">Extraordinária</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Status *</label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData({ ...formData, status: v as ReuniaoStatus })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Previsto">Previsto</SelectItem>
                                    <SelectItem value="Realizada">Realizada</SelectItem>
                                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Data da Reunião *</label>
                            <Input
                                type="date"
                                value={formData.data}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const updates: any = { data: val };
                                    // Auto-fill mês a partir da data selecionada
                                    if (val) {
                                        const dateObj = new Date(val + 'T12:00:00');
                                        updates.mes = MESES[dateObj.getMonth()];
                                    }
                                    setFormData({ ...formData, ...updates });
                                }}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Mês (por extenso) *</label>
                            <Select
                                value={formData.mes}
                                onValueChange={(v) => setFormData({ ...formData, mes: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o mês" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.map((mes) => (
                                        <SelectItem key={mes} value={mes} className="capitalize">
                                            {mes.charAt(0).toUpperCase() + mes.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Link Proad</label>
                        <Input
                            type="url"
                            value={formData.link_proad}
                            onChange={(e) => setFormData({ ...formData, link_proad: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Link Transparência</label>
                        <Input
                            type="url"
                            value={formData.link_transparencia}
                            onChange={(e) => setFormData({ ...formData, link_transparencia: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Link Ata de Reunião (externo)</label>
                        <Input
                            type="url"
                            value={formData.link_ata}
                            onChange={(e) => setFormData({ ...formData, link_ata: e.target.value })}
                            placeholder="https://... (opcional - use apenas se a ata estiver hospedada externamente)"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Use este campo apenas se a ata estiver hospedada em outro site.
                        </p>
                    </div>

                    {/* Upload de Ata (PDF) */}
                    <div className="border-t pt-4 mt-4">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <File className="h-4 w-4" />
                            Upload de Ata (PDF)
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Envie o arquivo PDF da ata (máx. 10MB). Este arquivo ficará disponível para visualização.
                        </p>

                        {/* Mostrar arquivo atual se existir e não estiver sendo removido */}
                        {item?.ata_filename && !removeAta && !ataFile && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                                <File className="h-5 w-5 text-green-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800">{item.ata_filename}</p>
                                    <p className="text-xs text-green-600">
                                        {item.ata_filesize ? formatFileSize(item.ata_filesize) : ''}
                                        {item.ata_uploaded_at ? ` • Enviado em ${new Date(item.ata_uploaded_at).toLocaleDateString('pt-BR')}` : ''}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={handleRemoveAta}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Mostrar arquivo selecionado para upload */}
                        {ataFile && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                                <Upload className="h-5 w-5 text-blue-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-800">{ataFile.name}</p>
                                    <p className="text-xs text-blue-600">{formatFileSize(ataFile.size)} • Pronto para enviar</p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-500 hover:text-slate-700"
                                    onClick={() => { setAtaFile(null); setUploadError(''); }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Indicador de remoção */}
                        {removeAta && item?.ata_filename && (
                            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                                <Trash2 className="h-5 w-5 text-red-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-800">Ata será removida ao salvar</p>
                                    <p className="text-xs text-red-600">Clique em "Selecionar arquivo" para cancelar</p>
                                </div>
                            </div>
                        )}

                        {/* Input de arquivo */}
                        {(!item?.ata_filename || removeAta || ataFile) && !ataFile && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    id="ata-upload"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="ata-upload"
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    <span className="text-sm">Selecionar arquivo PDF</span>
                                </label>
                            </div>
                        )}

                        {/* Erro de upload */}
                        {uploadError && (
                            <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                                {uploadError}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-sm font-medium">Observações</label>
                        <Textarea
                            value={formData.observacoes}
                            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                            placeholder="Ex: Reuniões Quinzenais"
                            rows={2}
                        />
                    </div>

                    {/* Erro de validação */}
                    {validationError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {validationError}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ModalPautaProps {
    open: boolean;
    item: ComiteReuniaoPauta | null;
    onClose: () => void;
    onSave: (data: { numero_item: number; descricao: string }) => void;
}

function ModalPauta({ open, item, onClose, onSave }: ModalPautaProps) {
    const [numeroItem, setNumeroItem] = useState('');
    const [descricao, setDescricao] = useState('');

    useEffect(() => {
        if (open) {
            setNumeroItem(item?.numero_item.toString() || '');
            setDescricao(item?.descricao || '');
        }
    }, [open, item]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!numeroItem || !descricao) return;
        onSave({ numero_item: parseInt(numeroItem), descricao });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar Item da Pauta' : 'Adicionar Item da Pauta'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Número do Item</label>
                        <Input
                            type="number"
                            value={numeroItem}
                            onChange={(e) => setNumeroItem(e.target.value)}
                            placeholder="1"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Descrição</label>
                        <Textarea
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descreva o item da pauta..."
                            rows={4}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ModalQuadroControleProps {
    open: boolean;
    item: ComiteQuadroControle | null;
    reunioes: ComiteReuniao[];
    onClose: () => void;
    onSave: (data: Partial<ComiteQuadroControle>) => void;
    onLoadPauta: (reuniaoId: number) => Promise<ComiteReuniaoPauta[]>;
}

function ModalQuadroControle({ open, item, reunioes, onClose, onSave, onLoadPauta }: ModalQuadroControleProps) {
    const [formData, setFormData] = useState({
        item: '',
        reuniao_id: null as number | null,
        item_pauta_id: null as number | null,
        responsavel: '',
        prazo: '',
        status: 'Andamento' as QuadroControleStatus
    });
    const [pautaItems, setPautaItems] = useState<ComiteReuniaoPauta[]>([]);
    const [loadingPauta, setLoadingPauta] = useState(false);

    useEffect(() => {
        if (open) {
            setFormData({
                item: item?.item || '',
                reuniao_id: item?.reuniao_id || null,
                item_pauta_id: item?.item_pauta_id || null,
                responsavel: item?.responsavel || '',
                prazo: item?.prazo?.split('T')[0] || '',
                status: item?.status || 'Andamento'
            });
            // Carregar pauta se já tiver reunião selecionada
            if (item?.reuniao_id) {
                handleLoadPauta(item.reuniao_id);
            } else {
                setPautaItems([]);
            }
        }
    }, [open, item]);

    const handleLoadPauta = async (reuniaoId: number) => {
        setLoadingPauta(true);
        try {
            const items = await onLoadPauta(reuniaoId);
            setPautaItems(items);
        } catch (err) {
            console.error('Erro ao carregar pauta:', err);
            setPautaItems([]);
        } finally {
            setLoadingPauta(false);
        }
    };

    const handleReuniaoChange = async (value: string) => {
        const reuniaoId = value ? parseInt(value) : null;
        setFormData(prev => ({ ...prev, reuniao_id: reuniaoId, item_pauta_id: null }));
        if (reuniaoId) {
            await handleLoadPauta(reuniaoId);
        } else {
            setPautaItems([]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.item) return;
        onSave(formData);
    };

    const formatReuniaoLabel = (reuniao: ComiteReuniao) => {
        const data = new Date(reuniao.data).toLocaleDateString('pt-BR');
        return `Reunião ${reuniao.numero}/${reuniao.ano} - ${data}`;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar Ação' : 'Nova Ação'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Ação - demanda estabelecida em reunião */}
                    <div>
                        <label className="text-sm font-medium">Ação *</label>
                        <p className="text-xs text-slate-500 mb-1">Demanda estabelecida em reunião</p>
                        <Textarea
                            value={formData.item}
                            onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                            placeholder="Descreva a ação demandada..."
                            required
                            rows={3}
                        />
                    </div>

                    {/* ID Reunião - Reunião que determinou a ação */}
                    <div>
                        <label className="text-sm font-medium">ID Reunião</label>
                        <p className="text-xs text-slate-500 mb-1">Reunião que determinou a ação</p>
                        <Select
                            value={formData.reuniao_id?.toString() || 'none'}
                            onValueChange={(v) => handleReuniaoChange(v === 'none' ? '' : v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a reunião" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                {reunioes.map((reuniao) => (
                                    <SelectItem key={reuniao.id} value={reuniao.id.toString()}>
                                        {formatReuniaoLabel(reuniao)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Item da Pauta - relacionado à ação demandada */}
                    <div>
                        <label className="text-sm font-medium">Item da Pauta</label>
                        <p className="text-xs text-slate-500 mb-1">Relacionado à ação demandada na reunião</p>
                        <Select
                            value={formData.item_pauta_id?.toString() || 'none'}
                            onValueChange={(v) => setFormData({ ...formData, item_pauta_id: v && v !== 'none' ? parseInt(v) : null })}
                            disabled={!formData.reuniao_id || loadingPauta}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={
                                    loadingPauta ? "Carregando..." :
                                        !formData.reuniao_id ? "Selecione uma reunião primeiro" :
                                            pautaItems.length === 0 ? "Nenhum item de pauta" :
                                                "Selecione o item da pauta"
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {pautaItems.map((pauta) => (
                                    <SelectItem key={pauta.id} value={pauta.id.toString()}>
                                        <span className="font-medium">Item {pauta.numero_item}:</span>{' '}
                                        <span className="text-slate-600">{pauta.descricao.length > 50 ? pauta.descricao.substring(0, 50) + '...' : pauta.descricao}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Responsáveis */}
                    <div>
                        <label className="text-sm font-medium">Responsáveis</label>
                        <p className="text-xs text-slate-500 mb-1">Servidor(es) responsável(is) pela ação demandada</p>
                        <Textarea
                            value={formData.responsavel}
                            onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                            placeholder="Nome dos responsáveis..."
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Prazo */}
                        <div>
                            <label className="text-sm font-medium">Prazo</label>
                            <p className="text-xs text-slate-500 mb-1">Data para entrega da ação</p>
                            <Input
                                type="date"
                                value={formData.prazo}
                                onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="text-sm font-medium">Status</label>
                            <p className="text-xs text-slate-500 mb-1">Indicação do status da ação</p>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData({ ...formData, status: v as QuadroControleStatus })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Andamento">Andamento</SelectItem>
                                    <SelectItem value="Concluída">Concluída</SelectItem>
                                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ModalMembroProps {
    open: boolean;
    item: ComiteMembro | null;
    onClose: () => void;
    onSave: (data: { nome: string; cargo: string }) => void;
}

function ModalMembro({ open, item, onClose, onSave }: ModalMembroProps) {
    const [nome, setNome] = useState('');
    const [cargo, setCargo] = useState('');

    useEffect(() => {
        if (open) {
            setNome(item?.nome || '');
            setCargo(item?.cargo || '');
        }
    }, [open, item]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome || !cargo) return;
        onSave({ nome, cargo });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar Membro' : 'Adicionar Membro'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Nome do Membro</label>
                        <Input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Nome completo"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Cargo</label>
                        <Textarea
                            value={cargo}
                            onChange={(e) => setCargo(e.target.value)}
                            placeholder="Cargo ou função"
                            rows={3}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ModalDescricaoProps {
    open: boolean;
    descricao: string;
    onClose: () => void;
    onSave: (descricao: string) => void;
}

function ModalDescricao({ open, descricao: initialDescricao, onClose, onSave }: ModalDescricaoProps) {
    const [descricao, setDescricao] = useState('');

    useEffect(() => {
        if (open) {
            setDescricao(initialDescricao);
        }
    }, [open, initialDescricao]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(descricao);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Descrição do Comitê</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Descrição Institucional</label>
                        <Textarea
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descrição do comitê..."
                            rows={8}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
