// PDVApp.jsx — PDV.ART.br
// 1. Copie para src/ do seu projeto React
// 2. Importe no App.jsx: import PDVApp from './PDVApp'; import './PDVApp.css';
// 3. Renderize: <PDVApp />

import React, { useState } from 'react';

/* ─── DADOS MOCK (substitua pelos seus hooks/fetch) ─── */
const PRODUCTS_DATA = [
  {id:1,  nome:'Açaí 300ml',          preco:11.20, custo:7.90,  unidade:'un', estoque:0,    barcode:'001'},
  {id:2,  nome:'Achocolatado 400g',   preco:10.21, custo:7.14,  unidade:'un', estoque:47,   barcode:'002'},
  {id:3,  nome:'Açúcar Refinado 1kg', preco:5.46,  custo:3.82,  unidade:'un', estoque:50,   barcode:'003'},
  {id:4,  nome:'Água com Gás 500ml',  preco:2.55,  custo:1.78,  unidade:'un', estoque:90,   barcode:'004'},
  {id:5,  nome:'Água Mineral 500ml',  preco:2.16,  custo:1.51,  unidade:'un', estoque:150,  barcode:'005'},
  {id:6,  nome:'Alface (unidade)',    preco:4.00,  custo:2.80,  unidade:'un', estoque:20,   barcode:'006'},
  {id:7,  nome:'Amaciante 2L',        preco:19.37, custo:13.56, unidade:'un', estoque:20,   barcode:'007'},
  {id:8,  nome:'Arroz Branco 5kg',    preco:28.60, custo:20.02, unidade:'un', estoque:40,   barcode:'008'},
  {id:9,  nome:'Banana Prata',        preco:6.32,  custo:4.42,  unidade:'kg', estoque:25.5, barcode:'009'},
  {id:10, nome:'Batata',              preco:6.30,  custo:4.41,  unidade:'kg', estoque:30,   barcode:'010'},
  {id:11, nome:'Batata Frita P',      preco:7.00,  custo:4.90,  unidade:'un', estoque:0,    barcode:'011'},
  {id:12, nome:'Biscoito Cream Cracker', preco:4.21, custo:2.94, unidade:'un', estoque:75,  barcode:'012'},
  {id:13, nome:'Bolacha Recheada 130g', preco:3.34, custo:2.34, unidade:'un', estoque:90,  barcode:'013'},
  {id:14, nome:'Cachorro-Quente',     preco:8.50,  custo:5.95,  unidade:'un', estoque:0,    barcode:'014'},
  {id:15, nome:'Café Expresso',       preco:3.00,  custo:2.10,  unidade:'un', estoque:0,    barcode:'015'},
  {id:16, nome:'Café Torrado 500g',   preco:21.00, custo:14.70, unidade:'un', estoque:30,   barcode:'016'},
  {id:17, nome:'Caipirinha',          preco:18.00, custo:12.60, unidade:'un', estoque:0,    barcode:'017'},
];
const INITIAL_SALES    = [{id:1, hora:'18:25', itens:1, pagamento:'Dinheiro', total:6.72}];
const INITIAL_COMANDAS = [{id:1, nome:'mesa 1', status:'aberta', abertaEm:'16/06, 17:54', itens:1, total:6.72}];
const INITIAL_EXTRATO  = [
  {id:1, data:'16/06, 18:25', tipo:'Entrada', valor:6.72,  descricao:'—', origem:'Venda'},
  {id:2, data:'12/06, 18:50', tipo:'Entrada', valor:57.27, descricao:'—', origem:'Venda'},
];

/* ─── HELPERS ─── */
const fmt  = (n) => Number(n).toFixed(2).replace('.', ',');
const fmtR = (n) => 'R$ ' + fmt(n);

/* ─── SHARED STYLES ─── */
const CARD       = { background:'#fff', borderRadius:12, border:'1.5px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.03)' };
const INPUT_BASE = { width:'100%', padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' };
const BTN_GREEN  = { background:'#16a34a', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' };
const BTN_GHOST  = { background:'#fff', color:'#6b7280', border:'1.5px solid #e5e7eb', padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' };
const TH_BASE    = { padding:'10px 20px', textAlign:'left', fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px' };
const TD_BASE    = { padding:'12px 20px', fontSize:13, color:'#374151' };

/* ─── ICON ─── */
const Ico = ({ d, cx, cy, r, x1, y1, x2, y2, points, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d       && <path d={d} />}
    {points  && <polygon points={points} />}
    {x1 !== undefined && <line x1={x1} y1={y1} x2={x2} y2={y2} />}
    {cx !== undefined && <circle cx={cx} cy={cy} r={r} />}
  </svg>
);

/* ─── PAYMENT BUTTON ─── */
function PmBtn({ method, label, active, onClick }) {
  const palette = { dinheiro:['#16a34a','#15803d'], cartao:['#4f46e5','#4338ca'], pix:['#0891b2','#0e7490'] };
  const [base, dark] = palette[method] || palette.dinheiro;
  return (
    <button onClick={onClick} style={{ padding:'7px 16px', borderRadius:8, whiteSpace:'nowrap', fontFamily:'inherit',
      border: active ? '2px solid rgba(255,255,255,0.35)' : '2px solid transparent',
      background: active ? dark : base, color:'#fff', fontSize:12,
      fontWeight: active ? 700 : 500, cursor:'pointer', opacity: active ? 1 : 0.78,
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.22)' : 'none' }}>
      {label}
    </button>
  );
}

/* ─── TAB BUTTON ─── */
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:'7px 14px', borderRadius:6, border:'none', fontFamily:'inherit',
      background: active ? '#16a34a' : 'transparent', color: active ? '#fff' : '#6b7280',
      fontSize:13, fontWeight: active ? 600 : 400, cursor:'pointer', whiteSpace:'nowrap' }}>
      {children}
    </button>
  );
}

/* ─── NAV ITEM ─── */
function NavItem({ id, label, icon, activePage, setActivePage }) {
  const active = activePage === id;
  return (
    <div onClick={() => setActivePage(id)} style={{ display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px', borderRadius:7, cursor:'pointer', fontSize:13,
      fontWeight: active ? 600 : 400, userSelect:'none',
      color: active ? '#c7d2fe' : 'rgba(148,163,184,0.7)',
      background: active ? 'rgba(99,102,241,0.18)' : 'transparent' }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

/* ─── SIDEBAR ─── */
function Sidebar({ activePage, setActivePage }) {
  const navItems = [
    { id:'caixa',      label:'Caixa',         icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg> },
    { id:'vendas',     label:'Vendas',         icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="10" width="4" height="10" rx="1"/><rect x="10" y="6" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="17" rx="1"/></svg> },
    { id:'produtos',   label:'Produtos',       icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
    { id:'estoque',    label:'Estoque',        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
    { id:'comandas',   label:'Comandas',       icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg> },
  ];
  const navItems2 = [
    { id:'financeiro', label:'Financeiro',     icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="17" cy="15" r="1" fill="currentColor"/></svg> },
    { id:'lucro',      label:'Lucro',          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
    { id:'config',     label:'Configurações',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2.2"/><circle cx="16" cy="12" r="2.2"/><circle cx="10" cy="18" r="2.2"/></svg> },
  ];

  return (
    <aside style={{ width:220, flexShrink:0, background:'#0d1526', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'22px 18px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize:19, fontWeight:700, letterSpacing:-0.5, color:'#fff', lineHeight:1 }}>
          PDV<span style={{ color:'#60a5fa', fontWeight:300 }}>.multi</span>
        </div>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:4, fontWeight:500, letterSpacing:'0.9px', textTransform:'uppercase', opacity:0.7 }}>Ponto de Venda</div>
      </div>
      <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
        {navItems.map(item  => <NavItem key={item.id}  {...item} activePage={activePage} setActivePage={setActivePage} />)}
        <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'8px 4px' }} />
        {navItems2.map(item => <NavItem key={item.id}  {...item} activePage={activePage} setActivePage={setActivePage} />)}
      </nav>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#818cf8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>N</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, color:'#e2e8f0', fontWeight:500 }}>Usuário</div>
          <div style={{ fontSize:10, color:'#94a3b8' }}>Admin</div>
        </div>
        <div style={{ fontSize:11, color:'#94a3b8', cursor:'pointer', opacity:0.6 }}>Sair</div>
      </div>
    </aside>
  );
}

/* ─── TOP BAR ─── */
function TopBar({ activePage, onOpenComanda }) {
  const titles = { caixa:'Caixa', vendas:'Vendas de hoje', produtos:'Produtos', estoque:'Estoque', comandas:'Comandas', financeiro:'Financeiro', lucro:'Lucro', config:'Configurações' };
  return (
    <div style={{ height:52, background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
      <div style={{ fontSize:15, fontWeight:600, color:'#111827', letterSpacing:-0.2 }}>{titles[activePage]}</div>
      <div>
        {activePage === 'produtos'  && <button style={BTN_GREEN}>+ Novo produto</button>}
        {activePage === 'comandas'  && <button onClick={onOpenComanda} style={BTN_GREEN}>+ Abrir comanda</button>}
      </div>
    </div>
  );
}

/* ─── PAGE: CAIXA ─── */
function CaixaPage({ products, setSales, setExtrato }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [qtyInput,    setQtyInput]    = useState('1');
  const [cart,        setCart]        = useState([]);
  const [payMethod,   setPayMethod]   = useState('dinheiro');
  const [modal,       setModal]       = useState(false);
  const [vlrRec,      setVlrRec]      = useState('');

  const cartTotal = cart.reduce((a, i) => a + i.preco * i.qty, 0);
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  const filtered = products.filter(p =>
    !searchQuery || p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery)
  );

  const addQty = (product, qty) => {
    setCart(prev => {
      const c = [...prev], idx = c.findIndex(i => i.id === product.id);
      if (idx >= 0) c[idx] = { ...c[idx], qty: c[idx].qty + qty };
      else c.push({ id:product.id, nome:product.nome, preco:product.preco, unidade:product.unidade, qty });
      return c;
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      addQty(filtered[0], parseInt(qtyInput) || 1);
      setSearchQuery(''); setQtyInput('1'); e.preventDefault();
    }
  };

  const finalizar = () => {
    const hora  = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const pags  = { dinheiro:'Dinheiro', cartao:'Cartão', pix:'Pix' };
    const data  = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ', ' + hora;
    setSales(prev => [{ id:Date.now(), hora, itens:cartCount, pagamento:pags[payMethod], total:cartTotal }, ...prev]);
    setExtrato(prev => [{ id:Date.now()+1, data, tipo:'Entrada', valor:cartTotal, descricao:'—', origem:'Venda' }, ...prev]);
    setCart([]); setModal(false); setPayMethod('dinheiro'); setVlrRec('');
  };

  const vrNum  = parseFloat((vlrRec || '').replace(',', '.')) || 0;
  const troco  = Math.max(0, vrNum - cartTotal);
  const hasTrc = payMethod === 'dinheiro' && vrNum > 0 && vrNum >= cartTotal;

  return (
    <div style={{ padding:'16px 20px', height:'calc(100vh - 52px)', display:'flex', flexDirection:'column', gap:12, overflow:'hidden', boxSizing:'border-box' }}>

      {/* Search row */}
      <div style={{ display:'flex', gap:10, alignItems:'stretch' }}>
        <div style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:9, padding:'0 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0, minWidth:96 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.6px' }}>Qtd.</span>
          <input type="number" min="1" value={qtyInput} onChange={e => setQtyInput(e.target.value || '1')}
            style={{ width:44, border:'none', fontSize:18, fontWeight:700, color:'#16a34a', textAlign:'center', background:'transparent', outline:'none', fontFamily:'inherit' }} />
        </div>
        <div style={{ position:'relative', flex:1 }}>
          <svg style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Código de barras ou nome — pressione Enter para adicionar..."
            style={{ ...INPUT_BASE, height:'100%', paddingLeft:38 }} />
          {searchQuery && filtered.length > 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.10)', zIndex:50, overflow:'hidden', maxHeight:300, overflowY:'auto' }}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => { addQty(p, parseInt(qtyInput)||1); setSearchQuery(''); setQtyInput('1'); }}
                  style={{ padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', borderBottom:'1px solid #f9fafb', gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{p.nome}</div>
                    <div style={{ fontSize:10, marginTop:3, fontWeight:500, color: p.estoque===0 ? '#ef4444' : '#9ca3af' }}>{p.estoque===0 ? 'Sem estoque' : 'Est: '+p.estoque}</div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#16a34a', flexShrink:0 }}>R$ {fmt(p.preco)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div style={{ ...CARD, flex:1, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* header */}
        <div style={{ padding:'13px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/></svg>
            <span style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Carrinho</span>
            <span style={{ fontSize:12, color:'#9ca3af' }}>{cartCount} {cartCount===1?'item':'itens'}</span>
          </div>
          <button onClick={() => setCart([])} style={{ fontSize:12, color:'#9ca3af', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6, fontFamily:'inherit' }}>Limpar tudo</button>
        </div>

        {/* items */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {cart.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:40, textAlign:'center', minHeight:200 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/></svg>
              </div>
              <div style={{ fontSize:14, fontWeight:500, color:'#374151', marginBottom:4 }}>Carrinho vazio</div>
              <div style={{ fontSize:13, color:'#9ca3af', lineHeight:1.6 }}>Digite o código ou nome acima e pressione <strong style={{ color:'#16a34a' }}>Enter</strong></div>
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 110px 110px', padding:'8px 20px', background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                {['Produto','Quantidade','Preço unit.','Subtotal'].map((h, i) => (
                  <div key={h} style={{ ...TH_BASE, padding:'8px 0', textAlign: i===0?'left': i===1?'center':'right' }}>{h}</div>
                ))}
              </div>
              {cart.map(item => (
                <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 130px 110px 110px', padding:'12px 20px', borderBottom:'1px solid #f9fafb', alignItems:'center' }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#111827', paddingRight:12 }}>{item.nome}</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <button onClick={() => setCart(p => p.map(i => i.id===item.id ? {...i,qty:i.qty-1} : i).filter(i => i.qty>0))}
                      style={{ width:26, height:26, borderRadius:6, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:15, color:'#374151', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ width:28, textAlign:'center', fontSize:13, fontWeight:700, color:'#111827' }}>{item.qty}</span>
                    <button onClick={() => setCart(p => p.map(i => i.id===item.id ? {...i,qty:i.qty+1} : i))}
                      style={{ width:26, height:26, borderRadius:6, border:'1.5px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:15, color:'#374151', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                  <div style={{ fontSize:13, color:'#6b7280', textAlign:'right' }}>R$ {fmt(item.preco)}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#16a34a', textAlign:'right' }}>R$ {fmt(item.preco*item.qty)}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* bottom bar */}
        <div style={{ borderTop:'1.5px solid #e5e7eb', padding:'14px 20px', display:'flex', alignItems:'center', gap:16, background:'#f8fafc' }}>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {[['dinheiro','Dinheiro'],['cartao','Cartão'],['pix','Pix']].map(([m,l]) => (
              <PmBtn key={m} method={m} label={l} active={payMethod===m} onClick={() => setPayMethod(m)} />
            ))}
          </div>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'baseline', gap:10, flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px' }}>Total</span>
            <span style={{ fontSize:28, fontWeight:700, color:'#111827', letterSpacing:-0.5 }}>R$ {fmt(cartTotal)}</span>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={() => setCart([])} style={BTN_GHOST}>Cancelar</button>
            <button onClick={() => { if (cart.length>0) setModal(true); }} style={{ ...BTN_GREEN, padding:'10px 22px' }}>Finalizar venda</button>
          </div>
        </div>
      </div>

      {/* Modal finalizar */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }} onClick={() => setModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, width:400, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.16)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:700, color:'#111827', marginBottom:3 }}>Confirmar venda</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:22 }}>Revise os dados e confirme para finalizar.</div>
            <div style={{ background:'#f9fafb', borderRadius:10, padding:16, marginBottom:14, border:'1px solid #f3f4f6' }}>
              {[['Itens no carrinho', cartCount],['Forma de pagamento',{dinheiro:'Dinheiro',cartao:'Cartão',pix:'Pix'}[payMethod]]].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:9 }}>
                  <span style={{ fontSize:12, color:'#6b7280' }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:'1px solid #e5e7eb', marginTop:12, paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#6b7280' }}>Total a pagar</span>
                <span style={{ fontSize:26, fontWeight:700, color:'#16a34a', letterSpacing:-0.5 }}>R$ {fmt(cartTotal)}</span>
              </div>
            </div>
            {payMethod === 'dinheiro' && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Valor recebido</label>
                <input value={vlrRec} onChange={e => setVlrRec(e.target.value)} placeholder="Ex.: 10,00"
                  style={{ ...INPUT_BASE, fontSize:16, fontWeight:600, borderRadius:8 }} />
                {hasTrc && (
                  <div style={{ marginTop:10, padding:'12px 16px', background:'#f0fdf4', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #bbf7d0' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize:13, color:'#15803d', fontWeight:600 }}>Troco</span>
                    </div>
                    <span style={{ fontSize:22, fontWeight:700, color:'#16a34a' }}>R$ {fmt(troco)}</span>
                  </div>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal(false)} style={{ ...BTN_GHOST, flex:1, padding:12, borderRadius:9, fontSize:14 }}>Voltar</button>
              <button onClick={finalizar} style={{ ...BTN_GREEN, flex:2, padding:12, borderRadius:9, fontSize:14 }}>Confirmar venda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PAGE: VENDAS ─── */
function VendasPage({ sales }) {
  const total  = sales.reduce((a, v) => a + v.total, 0);
  const ticket = sales.length ? total / sales.length : 0;
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[['Total do dia', fmtR(total), 'Faturamento hoje'],['Vendas', sales.length, 'Transações hoje'],['Ticket médio', fmtR(ticket), 'Por venda']].map(([label,value,sub]) => (
          <div key={label} style={{ ...CARD, padding:20 }}>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', fontWeight:600, marginBottom:8 }}>{label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:'#111827', letterSpacing:-0.5 }}>{value}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:600, color:'#111827' }}>Histórico do dia</div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:'#f9fafb' }}>
            {['Hora','Itens','Pagamento','Total'].map((h,i) => <th key={h} style={{ ...TH_BASE, textAlign:i===3?'right':'left' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {sales.map(v => (
              <tr key={v.id} style={{ borderTop:'1px solid #f3f4f6' }}>
                <td style={TD_BASE}>{v.hora}</td>
                <td style={TD_BASE}>{v.itens}</td>
                <td style={TD_BASE}><span style={{ background:'#f0fdf4', color:'#15803d', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{v.pagamento}</span></td>
                <td style={{ ...TD_BASE, textAlign:'right', fontWeight:700 }}>{fmtR(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PAGE: PRODUTOS ─── */
function ProdutosPage({ products }) {
  const [q, setQ] = useState('');
  const filtered = products.filter(p => !q || p.nome.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ position:'relative', maxWidth:380 }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produto..." style={{ ...INPUT_BASE, paddingLeft:33 }} />
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:'#f9fafb' }}>
            {['Produto','Preço venda','Un.','Estoque','Ações'].map((h,i) => <th key={h} style={{ ...TH_BASE, textAlign:[1,3].includes(i)?'right':i===2?'center':'left' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderTop:'1px solid #f3f4f6' }}>
                <td style={{ ...TD_BASE, fontWeight:500 }}>{p.nome}</td>
                <td style={{ ...TD_BASE, textAlign:'right', fontWeight:600, color:'#16a34a' }}>{fmtR(p.preco)}</td>
                <td style={{ ...TD_BASE, textAlign:'center', color:'#6b7280' }}>{p.unidade}</td>
                <td style={{ ...TD_BASE, textAlign:'right', fontWeight:p.estoque===0?600:500, color:p.estoque===0?'#ef4444':'#374151' }}>{p.estoque}</td>
                <td style={{ ...TD_BASE, textAlign:'center' }}><button style={{ fontSize:12, color:'#16a34a', background:'none', border:'none', cursor:'pointer', fontWeight:500, padding:'4px 8px', borderRadius:6, fontFamily:'inherit' }}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PAGE: ESTOQUE ─── */
function EstoquePage({ products }) {
  const [tab,  setTab]  = useState('entrada');
  const [prod, setProd] = useState('');
  const [qty,  setQty]  = useState('');
  const [mot,  setMot]  = useState('');
  const lowStock = products.filter(p => p.estoque <= 5);
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:18, maxWidth:680 }}>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:600, color:'#111827' }}>Nova movimentação</div>
        <div style={{ padding:20 }}>
          <div style={{ display:'inline-flex', gap:3, background:'#f3f4f6', borderRadius:8, padding:3, marginBottom:20 }}>
            <TabBtn active={tab==='entrada'} onClick={() => setTab('entrada')}>Entrada</TabBtn>
            <TabBtn active={tab==='ajuste'}  onClick={() => setTab('ajuste')}>Ajuste (inventário)</TabBtn>
          </div>
          {[['Produto',prod,setProd,'Buscar produto por nome...','text'],['Quantidade a adicionar',qty,setQty,'0','number'],['Motivo (opcional)',mot,setMot,'Ex.: compra fornecedor','text']].map(([label,val,setter,ph,type]) => (
            <div key={label} style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} type={type} style={INPUT_BASE} />
            </div>
          ))}
          <button onClick={() => { setProd(''); setQty(''); setMot(''); }} style={BTN_GREEN}>Registrar movimentação</button>
        </div>
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b' }} />
          <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Estoque baixo</div>
        </div>
        {lowStock.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Nenhum produto com estoque baixo.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#fffbeb' }}>
              {['Produto','Estoque','Preço'].map((h,i) => <th key={h} style={{ ...TH_BASE, color:'#92400e', textAlign:i>0?'right':'left', padding:'9px 20px' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lowStock.map(p => (
                <tr key={p.id} style={{ borderTop:'1px solid #f3f4f6' }}>
                  <td style={{ ...TD_BASE, fontWeight:500 }}>{p.nome}</td>
                  <td style={{ ...TD_BASE, textAlign:'right', fontWeight:700, color:'#ef4444' }}>{p.estoque}</td>
                  <td style={{ ...TD_BASE, textAlign:'right', color:'#6b7280' }}>{fmtR(p.preco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── PAGE: COMANDAS ─── */
function ComandasPage({ comandas, setComandas, modalRef }) {
  const [modal,    setModal]    = useState(false);
  const [novaNome, setNovaNome] = useState('');
  if (modalRef) modalRef.current = () => setModal(true);
  const abertas = comandas.filter(c => c.status === 'aberta');
  const criar = () => {
    if (!novaNome.trim()) return;
    const hora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    setComandas(prev => [...prev, { id:Date.now(), nome:novaNome, status:'aberta', abertaEm:'16/06, '+hora, itens:0, total:0 }]);
    setModal(false); setNovaNome('');
  };
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:22 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', marginBottom:12 }}>Abertas</div>
        {abertas.length === 0 ? (
          <div style={{ ...CARD, padding:40, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Nenhuma comanda aberta. Use o botão acima para abrir uma.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px,1fr))', gap:12 }}>
            {abertas.map(c => (
              <div key={c.id} style={{ ...CARD, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Comanda</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{c.nome}</div>
                  </div>
                  <span style={{ background:'#dcfce7', color:'#15803d', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>Aberta</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'12px 0', borderTop:'1px solid #f3f4f6', borderBottom:'1px solid #f3f4f6', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, marginBottom:2 }}>Aberta em</div>
                    <div style={{ fontSize:12, color:'#374151', fontWeight:500 }}>{c.abertaEm}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, marginBottom:2 }}>Total parcial</div>
                    <div style={{ fontSize:15, color:'#16a34a', fontWeight:700 }}>{fmtR(c.total)}</div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:12 }}>{c.itens} {c.itens===1?'item':'itens'}</div>
                <div style={{ display:'flex', gap:7 }}>
                  <button style={{ ...BTN_GHOST, flex:1, padding:7, borderRadius:7, fontSize:12 }}>Lançar item</button>
                  <button onClick={() => setComandas(prev => prev.map(x => x.id===c.id ? {...x,status:'fechada'} : x))}
                    style={{ ...BTN_GREEN, flex:1, padding:7, borderRadius:7, fontSize:12 }}>Fechar</button>
                  <button onClick={() => setComandas(prev => prev.filter(x => x.id!==c.id))}
                    style={{ padding:'7px 11px', borderRadius:7, border:'none', background:'#fef2f2', fontSize:12, fontWeight:500, color:'#ef4444', cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', marginBottom:12 }}>Histórico</div>
        <div style={{ ...CARD, padding:20 }}>
          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            {['De','Até'].map(l => (
              <div key={l}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#374151', marginBottom:5 }}>{l}</label>
              <input type="date" style={{ padding:'8px 12px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:13, fontFamily:'inherit', outline:'none' }}/></div>
            ))}
          </div>
          <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:13 }}>Nenhuma comanda no período.</div>
        </div>
      </div>
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }} onClick={() => setModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, width:360, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.16)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:700, color:'#111827', marginBottom:3 }}>Abrir comanda</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Digite o nome ou número da comanda.</div>
            <input value={novaNome} onChange={e => setNovaNome(e.target.value)} placeholder="Ex.: mesa 2, balcão, joão..."
              style={{ ...INPUT_BASE, fontSize:14, marginBottom:20, borderRadius:9 }} />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal(false)} style={{ ...BTN_GHOST, flex:1, padding:11, borderRadius:9, fontSize:14 }}>Cancelar</button>
              <button onClick={criar} style={{ ...BTN_GREEN, flex:2, padding:11, borderRadius:9, fontSize:14 }}>Abrir comanda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PAGE: FINANCEIRO ─── */
function FinanceiroPage({ extrato }) {
  const [tab,  setTab]  = useState('suprimento');
  const [val,  setVal]  = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:18, maxWidth:820 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ ...CARD, padding:20 }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', marginBottom:10 }}>Turno</div>
          <div style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:6 }}>Nenhum caixa aberto</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:16, lineHeight:1.5 }}>Abra o caixa informando o saldo inicial para começar o turno.</div>
          <button style={BTN_GREEN}>Abrir caixa</button>
        </div>
        <div style={{ ...CARD, padding:20 }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', marginBottom:10 }}>Saldo do caixa</div>
          <div style={{ fontSize:32, fontWeight:700, color:'#16a34a', letterSpacing:-0.8 }}>R$ 63,99</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:6 }}>Saldo atual acumulado</div>
        </div>
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', fontSize:14, fontWeight:600, color:'#111827' }}>Nova movimentação</div>
        <div style={{ padding:20 }}>
          <div style={{ display:'inline-flex', gap:3, background:'#f3f4f6', borderRadius:8, padding:3, marginBottom:18 }}>
            <TabBtn active={tab==='suprimento'} onClick={() => setTab('suprimento')}>Suprimento (entrada)</TabBtn>
            <TabBtn active={tab==='sangria'}    onClick={() => setTab('sangria')}>Sangria (saída)</TabBtn>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
            <div><label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Valor</label><input value={val} onChange={e => setVal(e.target.value)} placeholder="R$ 0,00" style={INPUT_BASE}/></div>
            <div><label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: troco inicial" style={INPUT_BASE}/></div>
          </div>
          <button onClick={() => { setVal(''); setDesc(''); }} style={BTN_GREEN}>Registrar movimentação</button>
        </div>
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Extrato</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="date" style={{ padding:'6px 10px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:12, fontFamily:'inherit', outline:'none' }} />
            <span style={{ fontSize:12, color:'#9ca3af' }}>até</span>
            <input type="date" style={{ padding:'6px 10px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:12, fontFamily:'inherit', outline:'none' }} />
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:'#f9fafb' }}>
            {['Data','Tipo','Valor','Descrição','Origem'].map((h,i) => <th key={h} style={{ ...TH_BASE, textAlign:i===2?'right':'left' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {extrato.map(e => (
              <tr key={e.id} style={{ borderTop:'1px solid #f3f4f6' }}>
                <td style={TD_BASE}>{e.data}</td>
                <td style={TD_BASE}>{e.tipo}</td>
                <td style={{ ...TD_BASE, textAlign:'right', fontWeight:600, color:e.tipo==='Entrada'?'#16a34a':'#ef4444' }}>{(e.tipo==='Entrada'?'+':'-')+fmtR(e.valor)}</td>
                <td style={{ ...TD_BASE, color:'#6b7280' }}>{e.descricao}</td>
                <td style={TD_BASE}>{e.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PAGE: LUCRO ─── */
function LucroPage({ sales }) {
  const total  = sales.reduce((a,v) => a+v.total, 0);
  const lucro  = total * 0.286;
  const custo  = total - lucro;
  const margem = total ? Math.round((lucro/total)*100) : 0;
  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:18, maxWidth:680 }}>
      <div style={{ ...CARD, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:12 }}>Período de análise</div>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
          {['De','Até'].map(l => <div key={l}><label style={{ display:'block', fontSize:11, fontWeight:600, color:'#9ca3af', marginBottom:5 }}>{l}</label><input type="date" style={{ padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }}/></div>)}
          <button style={BTN_GREEN}>Filtrar</button>
        </div>
      </div>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'20px 20px 16px' }}>
          <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.7px', color:'#9ca3af', fontWeight:600, marginBottom:6 }}>Lucro do período</div>
          <div style={{ fontSize:38, fontWeight:700, color:'#16a34a', letterSpacing:-1 }}>{fmtR(lucro)}</div>
        </div>
        <div style={{ borderTop:'1px solid #f3f4f6', display:'grid', gridTemplateColumns:'1fr 1fr' }}>
          {[['Faturamento',fmtR(total),true,true],['Custo',fmtR(custo),false,true],['Margem',margem+'%',true,false],['Vendas',sales.length,false,false]].map(([label,value,bR,bB]) => (
            <div key={label} style={{ padding:'16px 20px', borderRight:bR?'1px solid #f3f4f6':'none', borderBottom:bB?'1px solid #f3f4f6':'none' }}>
              <div style={{ fontSize:10, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:'#111827' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PAGE: CONFIG ─── */
function ConfigPage() {
  const [margem, setMargem] = useState('30,00');
  const [saved,  setSaved]  = useState('');
  return (
    <div style={{ padding:'24px 28px', maxWidth:520 }}>
      <div style={{ ...CARD, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Margem padrão</div>
          <div style={{ fontSize:12, color:'#9ca3af', marginTop:3, lineHeight:1.5 }}>Configure a margem % usada como padrão nos novos produtos (RF05).</div>
        </div>
        <div style={{ padding:20 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Margem padrão (%)</label>
          <input value={margem} onChange={e => setMargem(e.target.value)} style={{ ...INPUT_BASE, marginBottom:6 }} />
          <div style={{ fontSize:12, color:'#9ca3af', marginBottom:20, lineHeight:1.5 }}>Pré-preenche o campo de margem em cada novo produto.</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => { setSaved('✓ Salvo com sucesso!'); setTimeout(() => setSaved(''), 3000); }} style={BTN_GREEN}>Salvar</button>
            {saved && <span style={{ fontSize:12, color:'#16a34a', fontWeight:500 }}>{saved}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT APP ─── */
export default function PDVApp() {
  const [activePage, setActivePage] = useState('caixa');
  const [products]                  = useState(PRODUCTS_DATA);
  const [sales,      setSales]      = useState(INITIAL_SALES);
  const [comandas,   setComandas]   = useState(INITIAL_COMANDAS);
  const [extrato,    setExtrato]    = useState(INITIAL_EXTRATO);

  // ref para abrir modal de comanda via botão no TopBar
  const openComandaRef = { current: null };

  const titles = { caixa:'Caixa', vendas:'Vendas de hoje', produtos:'Produtos', estoque:'Estoque', comandas:'Comandas', financeiro:'Financeiro', lucro:'Lucro', config:'Configurações' };

  const pageMap = {
    caixa:      <CaixaPage      products={products} setSales={setSales} setExtrato={setExtrato} />,
    vendas:     <VendasPage     sales={sales} />,
    produtos:   <ProdutosPage   products={products} />,
    estoque:    <EstoquePage    products={products} />,
    comandas:   <ComandasPage   comandas={comandas} setComandas={setComandas} modalRef={openComandaRef} />,
    financeiro: <FinanceiroPage extrato={extrato} />,
    lucro:      <LucroPage      sales={sales} />,
    config:     <ConfigPage />,
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f1f5f9', fontSize:14, color:'#111827', fontFamily:"'Roboto', system-ui, sans-serif" }}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Top bar */}
        <div style={{ height:52, background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'#111827', letterSpacing:-0.2 }}>{titles[activePage]}</div>
          <div>
            {activePage === 'produtos' && <button style={BTN_GREEN}>+ Novo produto</button>}
            {activePage === 'comandas' && <button onClick={() => openComandaRef.current?.()} style={BTN_GREEN}>+ Abrir comanda</button>}
          </div>
        </div>
        {/* Page */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
          {pageMap[activePage]}
        </div>
      </div>
    </div>
  );
}
