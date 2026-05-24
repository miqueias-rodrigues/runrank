import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

/* ─── Fonte Barlow Condensed ─── */
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap'
document.head.appendChild(fontLink)

/* ─── Constantes de cor ─── */
const C = {
  navy:   '#0D0F1A',
  navy2:  '#13162A',
  navy3:  '#1C2040',
  red:    '#E8354A',
  red2:   '#FF4D63',
  orange: '#FF7A3D',
  gold:   '#FFB830',
  silver: '#B0BEC5',
  bronze: '#A0714F',
  text:   '#E8ECF4',
  muted:  '#6B7499',
  border: 'rgba(255,255,255,0.06)',
  card:   'rgba(255,255,255,0.04)',
}

const STORAGE_KEY = 'runrank_strava_id'

const AVATAR_COLORS = [
  '#C0392B','#1565C0','#2E7D32','#6A1B9A',
  '#00695C','#E65100','#1A237E','#880E4F',
]

function avatarBg(index) { return AVATAR_COLORS[index % AVATAR_COLORS.length] }

function iniciais(nome) {
  if (!nome) return '?'
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ src, nome, size = 44, index = 0, borderColor = null }) {
  const [erro, setErro] = useState(false)
  const bg  = avatarBg(index)
  const bdr = borderColor || bg
  const ok  = src && !erro && !src.includes('avatar/athlete')

  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${bdr}`, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800, fontSize: size * 0.36, color: '#fff',
    background: bg,
  }

  return ok
    ? <img src={src.startsWith('http') ? src : `https://www.strava.com/${src}`}
           alt={nome} onError={() => setErro(true)}
           style={{ ...base, objectFit: 'cover', background: 'none' }} />
    : <div style={base}>{iniciais(nome)}</div>
}

function inicioDeMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function mesAtualLabel() {
  return new Date()
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

/* ─── App principal ─── */
export default function App() {
  const [ranking,  setRanking]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [usuario,  setUsuario]  = useState(null)
  const [aba,      setAba]      = useState('ranking')
  const [tabKm,    setTabKm]    = useState('total_km')
  const [corridas, setCorridas] = useState([])

  const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
  const FUNCTION_URL     = 'https://vgathsrrzurpzmiapdte.supabase.co/functions/v1/hyper-service'
  const redirectUri      = `${window.location.origin}/callback`

  const stravaAuthUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${STRAVA_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&approval_prompt=force` +
    `&scope=activity:read,profile:read_all`

  async function carregarRanking() {
    const { data } = await supabase
      .from('ranking_mensal').select('*')
      .order('total_km', { ascending: false })
    setRanking(data || [])
  }

  async function buscarUsuario(stravaId) {
    const { data, error } = await supabase
      .from('users').select('*').eq('strava_id', stravaId).single()
    if (!error && data) { setUsuario(data); return data }
    return null
  }

  async function carregarCorridasDoMes(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('activities').select('*')
      .eq('user_id', userId)
      .gte('start_date', inicioDeMes())
      .order('start_date', { ascending: false })
    setCorridas(data || [])
  }

  async function processarCallback(code) {
    setLoading(true)
    try {
      const res    = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const result = await res.json()
      if (result?.athlete?.id) {
        localStorage.setItem(STORAGE_KEY, String(result.athlete.id))
        const user = await buscarUsuario(result.athlete.id)
        if (user) await carregarCorridasDoMes(user.id)
      }
      await carregarRanking()
    } catch (err) {
      console.error('Erro callback:', err)
    } finally {
      window.history.replaceState({}, document.title, '/')
      setLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      await carregarRanking()
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')
      if (code) { await processarCallback(code); return }
      const salvo = localStorage.getItem(STORAGE_KEY)
      if (salvo) {
        const user = await buscarUsuario(salvo)
        if (user) await carregarCorridasDoMes(user.id)
      }
    }
    init()
  }, [])

  const meuRanking   = ranking.find(r => r.id === usuario?.id)
  const minhaPosicao = ranking.findIndex(r => r.id === usuario?.id) + 1

  /* ranking ordenado pela tab ativa */
  const rankingOrdenado = [...ranking].sort((a, b) =>
    Number(b[tabKm] || 0) - Number(a[tabKm] || 0)
  )
  const top3  = rankingOrdenado.slice(0, 3)
  const resto = rankingOrdenado.slice(3)

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
    setCorridas([])
  }

  /* ── gráfico semanal (últimos 7 dias) ── */
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const hoje = new Date()
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - 6 + i)
    return d
  })
  const kmPorDia = semana.map(d => {
    const iso = d.toISOString().slice(0, 10)
    const total = corridas
      .filter(c => c.start_date?.slice(0, 10) === iso)
      .reduce((s, c) => s + (c.distance_meters || 0) / 1000, 0)
    return { dia: dias[d.getDay()], km: total, isHoje: i => i === 6 }
  })
  const maxKmDia = Math.max(...kmPorDia.map(d => d.km), 1)

  /* ── conquistas baseadas em dados reais ── */
  const conquistas = [
    { emoji: '🔥', label: '7 dias seguidos', ganhou: corridas.length >= 7 },
    { emoji: '⚡', label: 'Primeiro 10k',     ganhou: corridas.some(c => c.distance_meters >= 10000) },
    { emoji: '🌙', label: 'Corrida noturna',  ganhou: corridas.some(c => { const h = new Date(c.start_date).getHours(); return h >= 20 || h < 6 }) },
    { emoji: '🏔️', label: '100km no mês',     ganhou: Number(meuRanking?.total_km || 0) >= 100 },
    { emoji: '👑', label: 'Top 3 ranking',    ganhou: minhaPosicao > 0 && minhaPosicao <= 3 },
  ]

  /* ── estilos base ── */
  const S = {
    app: {
      minHeight: '100vh',
      background: '#080A14',
      color: C.text,
      fontFamily: "'Barlow', sans-serif",
      paddingBottom: 100,
    },
    inner: { maxWidth: 430, margin: '0 auto', padding: '0 0 20px' },

    /* header ranking */
    rankHeader: {
      padding: '52px 20px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${C.border}`,
    },
    monthLabel: {
      fontSize: 10, fontWeight: 600, letterSpacing: 3,
      textTransform: 'uppercase', color: C.red, display: 'block',
    },
    pageTitle: {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 900, fontSize: 32, letterSpacing: -0.5, lineHeight: 1,
    },

    /* tabs categoria */
    tabsRow: {
      display: 'flex', gap: 8, padding: '14px 20px',
      overflowX: 'auto', scrollbarWidth: 'none',
    },
    tab: (active) => ({
      flexShrink: 0, height: 34, padding: '0 16px', borderRadius: 100,
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase',
      border: `1px solid ${active ? C.red : C.border}`,
      background: active ? C.red : 'transparent',
      color: active ? '#fff' : C.muted,
      cursor: 'pointer', whiteSpace: 'nowrap',
      boxShadow: active ? '0 4px 16px rgba(232,53,74,0.3)' : 'none',
    }),

    /* pódio */
    podiumSection: {
      padding: '12px 20px 16px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8,
    },
    podiumCard: (tipo) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      order: tipo === 'first' ? 2 : tipo === 'second' ? 1 : 3,
    }),
    podiumBase: (tipo) => ({
      borderRadius: '10px 10px 0 0', width: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0',
      height: tipo === 'first' ? 56 : tipo === 'second' ? 40 : 28,
      background: tipo === 'first'
        ? 'rgba(255,184,48,0.12)'
        : tipo === 'second'
          ? 'rgba(176,190,197,0.08)'
          : 'rgba(160,113,79,0.08)',
      border: `1px solid ${tipo === 'first'
        ? 'rgba(255,184,48,0.2)'
        : tipo === 'second'
          ? 'rgba(176,190,197,0.15)'
          : 'rgba(160,113,79,0.15)'}`,
    }),
    podiumKm: (tipo) => ({
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 900, textAlign: 'center', lineHeight: 1,
      fontSize: tipo === 'first' ? 22 : 18,
      color: tipo === 'first' ? C.gold : tipo === 'second' ? C.silver : C.bronze,
    }),
    podiumPos: (tipo) => ({
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 900, fontSize: 16,
      color: tipo === 'first' ? C.gold : tipo === 'second' ? C.silver : C.bronze,
    }),

    /* lista */
    rankList: { padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 6 },
    rankItem: (souEu) => ({
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 14, position: 'relative', overflow: 'hidden',
      background: souEu ? 'rgba(232,53,74,0.06)' : C.card,
      border: `1px solid ${souEu ? 'rgba(232,53,74,0.2)' : C.border}`,
    }),

    /* tab bar */
    tabBar: {
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: C.navy, borderTop: `1px solid ${C.border}`,
      display: 'flex', padding: '10px 0 24px', zIndex: 20,
    },
    tabItem: (active) => ({
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 3, cursor: 'pointer', background: 'none', border: 'none',
    }),
    tabLbl: (active) => ({
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
      color: active ? C.red : C.muted,
    }),
  }

  const tabItems = [
    { id: 'ranking', icon: '🏆', label: 'Ranking' },
    { id: 'corridas', icon: '🏃', label: 'Corridas' },
    { id: 'perfil', icon: '👤', label: 'Perfil' },
  ]

  const tabsKm = [
    { id: 'total_km',        label: 'Total KM' },
    { id: 'total_corridas',  label: 'Corridas' },
    { id: 'maior_corrida_km',label: 'Maior Dist.' },
  ]

  function valorTab(atleta) {
    const v = Number(atleta[tabKm] || 0)
    if (tabKm === 'total_corridas') return `${v} corridas`
    return `${v.toFixed(1)} km`
  }

  const tiposPodio = ['second', 'first', 'third']

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div style={S.app}>
      <div style={S.inner}>

        {/* ── TELA LOGIN ── */}
        {!usuario && aba === 'ranking' && (
          <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end',
            paddingBottom: 60, position: 'relative', overflow: 'hidden',
          }}>
            {/* fundos decorativos */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 200px 300px at 50% 30%, rgba(232,53,74,0.18) 0%, transparent 70%),
                           radial-gradient(ellipse 300px 200px at 80% 10%, rgba(255,122,61,0.1) 0%, transparent 60%),
                           linear-gradient(180deg, ${C.navy} 0%, #080A14 100%)`,
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, opacity: 0.07,
              background: 'repeating-linear-gradient(0deg,transparent,transparent 38px,rgba(255,255,255,0.4) 38px,rgba(255,255,255,0.4) 40px)',
            }} />
            {/* runner */}
            <div style={{ position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)', opacity: 0.9 }}>
              <svg viewBox="0 0 90 90" width="90" height="90">
                <circle cx="52" cy="18" r="10" fill={C.red} />
                <line x1="52" y1="28" x2="46" y2="52" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
                <line x1="50" y1="36" x2="30" y2="28" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
                <line x1="50" y1="36" x2="66" y2="46" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="26" y2="66" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
                <line x1="26" y1="66" x2="18" y2="82" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="58" y2="68" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
                <line x1="58" y1="68" x2="74" y2="72" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
                <line x1="14" y1="82" x2="2"  y2="82" stroke={C.red} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>

            <div style={{ position: 'relative', zIndex: 2, width: '100%', padding: '0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* logo */}
              <div style={{
                width: 64, height: 64, background: C.red, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, boxShadow: '0 8px 32px rgba(232,53,74,0.4)',
              }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 32, color: '#fff', letterSpacing: -1 }}>RR</span>
              </div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 52, letterSpacing: -1, color: '#fff', lineHeight: 1, marginBottom: 6 }}>
                Run<span style={{ color: C.red }}>Rank</span>
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 48, textAlign: 'center' }}>
                Iguatu corre. Quem lidera?
              </div>
              <a href={stravaAuthUrl} style={{
                width: '100%', height: 56, background: C.red, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                color: '#fff', textDecoration: 'none',
                fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 18,
                letterSpacing: 1, textTransform: 'uppercase',
                boxShadow: '0 8px 24px rgba(232,53,74,0.35)',
              }}>
                <span style={{ width: 22, height: 22, background: '#fff', flexShrink: 0, clipPath: 'polygon(30% 0%,100% 0%,70% 50%,100% 50%,0% 100%,30% 50%,0% 50%)' }} />
                {loading ? 'Sincronizando...' : 'Entrar com Strava'}
              </a>
              <p style={{ marginTop: 16, fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
                Seus dados de corrida são importados<br />diretamente do Strava. Nenhum GPS é ativado.
              </p>
            </div>
          </div>
        )}

        {/* ── ABA RANKING (logado) ── */}
        {(usuario || ranking.length > 0) && aba === 'ranking' && (
          <>
            {/* header */}
            <div style={S.rankHeader}>
              <div>
                <span style={S.monthLabel}>{mesAtualLabel()}</span>
                <span style={S.pageTitle}>Ranking</span>
              </div>
              {usuario
                ? <Avatar src={usuario.profile_picture} nome={usuario.name} size={36} index={0} borderColor={C.red} />
                : <div style={{ width: 36, height: 36 }} />
              }
            </div>

            {/* tabs categoria */}
            <div style={S.tabsRow}>
              {tabsKm.map(t => (
                <button key={t.id} style={S.tab(tabKm === t.id)} onClick={() => setTabKm(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {ranking.length === 0 && (
              <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0' }}>
                Nenhum atleta no ranking ainda.
              </p>
            )}

            {/* pódio top 3 */}
            {top3.length > 0 && (
              <div style={S.podiumSection}>
                {tiposPodio.map((tipo, ti) => {
                  const idx   = tipo === 'first' ? 0 : tipo === 'second' ? 1 : 2
                  const atleta = top3[idx]
                  if (!atleta) return null
                  const avSize = tipo === 'first' ? 64 : 52
                  const borderC = tipo === 'first' ? C.gold : tipo === 'second' ? C.silver : C.bronze
                  return (
                    <div key={atleta.id} style={S.podiumCard(tipo)}>
                      <div style={{ position: 'relative' }}>
                        {tipo === 'first' && (
                          <span style={{
                            position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 18,
                          }}>👑</span>
                        )}
                        <Avatar src={atleta.profile_picture} nome={atleta.name}
                                size={avSize} index={idx} borderColor={borderC} />
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 13, textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {atleta.name.split(' ')[0]}
                      </div>
                      <div style={S.podiumKm(tipo)}>
                        {Number(atleta[tabKm] || 0).toFixed(tabKm === 'total_corridas' ? 0 : 1)}
                        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>
                          {tabKm === 'total_corridas' ? ' x' : ' km'}
                        </span>
                      </div>
                      <div style={S.podiumBase(tipo)}>
                        <span style={S.podiumPos(tipo)}>
                          {tipo === 'first' ? '1°' : tipo === 'second' ? '2°' : '3°'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* lista 4+ */}
            <div style={S.rankList}>
              {resto.map((atleta, i) => {
                const pos   = i + 4
                const souEu = atleta.id === usuario?.id
                const idx   = pos - 1
                return (
                  <div key={atleta.id} style={S.rankItem(souEu)}>
                    {souEu && (
                      <span style={{
                        position: 'absolute', top: 6, right: 10,
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontWeight: 700, fontSize: 9, letterSpacing: 1.5, color: C.red,
                      }}>VOCÊ</span>
                    )}
                    <span style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
                      fontSize: 20, color: souEu ? C.red : C.muted, width: 24, textAlign: 'center', flexShrink: 0,
                    }}>{pos}</span>
                    <Avatar src={atleta.profile_picture} nome={atleta.name}
                            size={40} index={idx} borderColor={souEu ? C.red : undefined} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 16,
                        color: souEu ? C.red2 : C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{atleta.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                        {atleta.total_corridas} corrida{atleta.total_corridas !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 22,
                      color: souEu ? C.red2 : C.text, textAlign: 'right', flexShrink: 0,
                    }}>
                      {Number(atleta[tabKm] || 0).toFixed(tabKm === 'total_corridas' ? 0 : 1)}
                      <small style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: 'block', textAlign: 'right', lineHeight: 1 }}>
                        {tabKm === 'total_corridas' ? 'x' : 'km'}
                      </small>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTA login se não logado */}
            {!usuario && (
              <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
                <a href={stravaAuthUrl} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 52, background: C.red, borderRadius: 14,
                  color: '#fff', textDecoration: 'none',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                  fontSize: 17, letterSpacing: 1, textTransform: 'uppercase',
                  boxShadow: '0 6px 20px rgba(232,53,74,0.35)',
                }}>
                  <span style={{ width: 18, height: 18, background: '#fff', flexShrink: 0, clipPath: 'polygon(30% 0%,100% 0%,70% 50%,100% 50%,0% 100%,30% 50%,0% 50%)' }} />
                  Entrar e aparecer no ranking
                </a>
              </div>
            )}
          </>
        )}

        {/* ── ABA CORRIDAS ── */}
        {aba === 'corridas' && (
          <div>
            <div style={{ ...S.rankHeader, marginBottom: 0 }}>
              <div>
                <span style={S.monthLabel}>{mesAtualLabel()}</span>
                <span style={S.pageTitle}>Minhas Corridas</span>
              </div>
              <span style={{ fontSize: 22 }}>🏃</span>
            </div>
            <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!usuario && (
                <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0' }}>
                  Entre com o Strava para ver suas corridas.
                </p>
              )}
              {usuario && corridas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🏃</div>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 18 }}>
                    Nenhuma corrida registrada este mês.
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Corra e volte aqui!</div>
                </div>
              )}
              {corridas.map((corrida) => {
                const km      = (corrida.distance_meters / 1000).toFixed(2)
                const minutos = Math.round((corrida.moving_time_sec || 0) / 60)
                const data    = new Date(corrida.start_date).toLocaleDateString('pt-BR')
                const pace    = corrida.moving_time_sec && corrida.distance_meters
                  ? Math.round(corrida.moving_time_sec / (corrida.distance_meters / 1000))
                  : null
                const pill = (cor, txt) => (
                  <span style={{
                    background: `rgba(${cor},0.1)`, border: `1px solid rgba(${cor},0.22)`,
                    borderRadius: 10, padding: '4px 10px', fontSize: 13, fontWeight: 700,
                  }}>{txt}</span>
                )
                return (
                  <div key={corrida.id} style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 16, padding: 14,
                  }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
                      fontSize: 17, color: C.text, marginBottom: 10,
                    }}>🏃 {corrida.name || 'Corrida'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {pill('232,53,74', `📏 ${km} km`)}
                      {pill('255,255,255', `⏱ ${minutos} min`)}
                      {pace && pill('255,255,255', `⚡ ${Math.floor(pace/60)}:${String(pace%60).padStart(2,'0')}/km`)}
                    </div>
                    <div style={{ color: C.muted, marginTop: 8, fontSize: 12 }}>
                      {data} · {corrida.activity_type}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ABA PERFIL ── */}
        {aba === 'perfil' && (
          <div>
            {!usuario ? (
              <div style={{ textAlign: 'center', padding: '80px 32px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
                <a href={stravaAuthUrl} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  height: 52, background: C.red, borderRadius: 14,
                  color: '#fff', textDecoration: 'none',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                  fontSize: 17, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  <span style={{ width: 18, height: 18, background: '#fff', flexShrink: 0, clipPath: 'polygon(30% 0%,100% 0%,70% 50%,100% 50%,0% 100%,30% 50%,0% 50%)' }} />
                  Entrar com Strava
                </a>
              </div>
            ) : (
              <>
                {/* hero perfil */}
                <div style={{
                  padding: '52px 20px 24px', position: 'relative',
                  background: `linear-gradient(180deg, ${C.navy2} 0%, ${C.navy} 100%)`,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 200, height: 100, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse, rgba(232,53,74,0.15) 0%, transparent 70%)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, position: 'relative' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar src={usuario.profile_picture} nome={usuario.name} size={72} index={0} borderColor={C.red} />
                      {minhaPosicao > 0 && minhaPosicao <= 3 && (
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 22, height: 22, background: C.gold, borderRadius: '50%',
                          border: `2px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11,
                        }}>🥇</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 4 }}>
                        {usuario.name}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(232,53,74,0.12)', border: '1px solid rgba(232,53,74,0.25)',
                        borderRadius: 100, padding: '4px 10px',
                        fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 13, color: C.red2,
                      }}>
                        🏆 {minhaPosicao > 0 ? `${minhaPosicao}° no ranking` : 'Sem corridas ainda'}
                      </div>
                    </div>
                    <button onClick={logout} style={{
                      marginLeft: 'auto', background: 'rgba(255,255,255,.06)',
                      border: `1px solid ${C.border}`, borderRadius: 10,
                      color: C.muted, fontSize: 11, padding: '6px 10px', cursor: 'pointer',
                      fontFamily: "'Barlow',sans-serif",
                    }}>Sair</button>
                  </div>

                  {/* stats grid 3 colunas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[
                      { val: Number(meuRanking?.total_km || 0).toFixed(1), lbl: 'km este mês', cor: C.red },
                      { val: corridas.length,                               lbl: 'corridas',    cor: C.text },
                      { val: Number(meuRanking?.maior_corrida_km || 0).toFixed(1), lbl: 'maior km', cor: C.gold },
                    ].map((s, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                        borderRadius: 12, padding: '12px 10px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 24, lineHeight: 1, color: s.cor }}>
                          {s.val}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>
                          {s.lbl}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* gráfico semanal */}
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                    fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginBottom: 14,
                  }}>Atividade — última semana</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                    {kmPorDia.map((d, i) => {
                      const isHoje  = i === 6
                      const temKm   = d.km > 0
                      const altura  = Math.max(8, Math.round((d.km / maxKmDia) * 72))
                      const corBar  = isHoje ? C.orange : temKm ? C.red : C.navy3
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{
                            width: '100%', borderRadius: '6px 6px 2px 2px',
                            height: altura, background: corBar,
                            boxShadow: isHoje ? '0 0 12px rgba(255,122,61,0.4)' : 'none',
                          }} />
                          <span style={{
                            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                            color: isHoje ? C.orange : C.muted,
                          }}>{d.dia}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* conquistas */}
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                    fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginBottom: 14,
                  }}>Conquistas</div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                    {conquistas.map((c, i) => (
                      <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: 16, fontSize: 22,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: c.ganhou ? 'rgba(255,184,48,0.1)' : C.card,
                          border: `1px solid ${c.ganhou ? 'rgba(255,184,48,0.3)' : C.border}`,
                          opacity: c.ganhou ? 1 : 0.4,
                          filter: c.ganhou ? 'none' : 'grayscale(1)',
                        }}>{c.emoji}</div>
                        <span style={{ fontSize: 10, color: C.muted, textAlign: 'center', maxWidth: 54, lineHeight: 1.3 }}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* compartilhar */}
                <div style={{ padding: '20px 20px 0' }}>
                  <a href={`https://wa.me/?text=${encodeURIComponent(
                    `🏃 Estou em ${minhaPosicao}° lugar no RunRank Iguatu com ${Number(meuRanking?.total_km || 0).toFixed(1)} km esse mês! Corre lá: ${window.location.origin}`
                  )}`} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)',
                    borderRadius: 14, padding: '14px 20px',
                    color: '#25D366', fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 700, fontSize: 17, textDecoration: 'none', letterSpacing: 0.5,
                  }}>
                    <span style={{ fontSize: 20 }}>📲</span>
                    Compartilhar no WhatsApp
                  </a>
                </div>
              </>
            )}
          </div>
        )}

      </div>{/* /inner */}

      {/* ── TAB BAR ── */}
      <div style={{ ...S.tabBar, maxWidth: 430, left: '50%', transform: 'translateX(-50%)', width: '100%' }}>
        {tabItems.map(t => (
          <button key={t.id} style={S.tabItem(aba === t.id)} onClick={() => setAba(t.id)}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={S.tabLbl(aba === t.id)}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
