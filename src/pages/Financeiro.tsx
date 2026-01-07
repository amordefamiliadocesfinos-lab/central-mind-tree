import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MobileHeader } from '@/components/ui/mobile-header';
import { 
  FinancialDashboard, 
  FinancialEntriesList, 
  AccountsManager,
  CategoriesManager,
} from '@/components/financial';
import { useFinancial, EntryStatus } from '@/hooks/useFinancial';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, LayoutDashboard, TrendingDown, TrendingUp, Wallet, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Financeiro() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pagarStatus, setPagarStatus] = useState<EntryStatus | 'all'>('all');
  const [receberStatus, setReceberStatus] = useState<EntryStatus | 'all'>('all');
  const [pagarSearch, setPagarSearch] = useState('');
  const [receberSearch, setReceberSearch] = useState('');
  
  const {
    entries,
    categories,
    accounts,
    loading,
    filters,
    setFilters,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    registerPayment,
    conciliateEntry,
    exportToCSV,
    saveAccount,
    saveCategory,
  } = useFinancial();

  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    const newFilters = {
      ...filters,
      startDate: start || startOfMonth(new Date()),
      endDate: end || endOfMonth(new Date()),
    };
    setFilters(newFilters);
    fetchEntries(newFilters);
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="Financeiro" showBack />
      
      <div className="container mx-auto p-4 space-y-4">
        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate && filters.endDate ? (
                  <>
                    {format(filters.startDate, "dd/MM/yyyy", { locale: ptBR })} -{' '}
                    {format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  <span>Selecionar período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: filters.startDate,
                  to: filters.endDate,
                }}
                onSelect={(range) => {
                  handleDateRangeChange(range?.from, range?.to);
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const start = startOfMonth(new Date());
              const end = endOfMonth(new Date());
              handleDateRangeChange(start, end);
            }}
          >
            Este mês
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className={cn("grid w-full", isMobile ? "grid-cols-3" : "grid-cols-5")}>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {!isMobile && "Dashboard"}
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              {!isMobile && "A Receber"}
            </TabsTrigger>
            <TabsTrigger value="pagar" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              {!isMobile && "A Pagar"}
            </TabsTrigger>
            {!isMobile && (
              <>
                <TabsTrigger value="contas" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  Caixas/Bancos
                </TabsTrigger>
                <TabsTrigger value="categorias" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Categorias
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {isMobile && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contas" className="gap-2">
                <Wallet className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="categorias" className="gap-2">
                <Tag className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="dashboard">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="receber">
            <FinancialEntriesList
              entries={entries}
              type="receber"
              categories={categories}
              accounts={accounts}
              loading={loading}
              onCreateEntry={createEntry}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onRegisterPayment={registerPayment}
              onConciliate={conciliateEntry}
              onExport={() => exportToCSV('receber')}
              statusFilter={receberStatus}
              onStatusFilterChange={setReceberStatus}
              searchQuery={receberSearch}
              onSearchChange={setReceberSearch}
            />
          </TabsContent>

          <TabsContent value="pagar">
            <FinancialEntriesList
              entries={entries}
              type="pagar"
              categories={categories}
              accounts={accounts}
              loading={loading}
              onCreateEntry={createEntry}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onRegisterPayment={registerPayment}
              onConciliate={conciliateEntry}
              onExport={() => exportToCSV('pagar')}
              statusFilter={pagarStatus}
              onStatusFilterChange={setPagarStatus}
              searchQuery={pagarSearch}
              onSearchChange={setPagarSearch}
            />
          </TabsContent>

          <TabsContent value="contas">
            <AccountsManager accounts={accounts} onSave={saveAccount} />
          </TabsContent>

          <TabsContent value="categorias">
            <CategoriesManager categories={categories} onSave={saveCategory} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
