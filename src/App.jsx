import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const STORAGE_KEY = 'runrank_strava_id'

const AVATAR_COLORS = [
  ['#C0392B', '#E74C3C'],
  ['#1565C0', '#1E88E5'],
  ['#2E7D32', '#43A047'],
  ['#6A1B9A', '#8E24AA'],
  ['#00695C', '#00897B'],
  ['#E65100', '#FB8C00'],
  ['#1A237E', '#3949AB'],
  ['#880E4F', '#C2185B'],
]

function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function iniciais(nome) {
  if (!nome) return '?'
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ src, nome, size = 44, index = 0, border = null }) {
  const [erro, setErro] = useState(false)
  const [cor1, cor2]   = avatarColor(index)
  const temFoto        = src && !erro && !src.includes('avatar/athlete')

  return temFoto ? (
    <img
      src={src.startsWith('http') ? src : `https://www.strava.com/${src}`}
      alt={nome}
      onError={() => setErro(true)}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: border || `2px solid ${cor1}`,
        flexShrink: 0,
      }}
    />
  ) : (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${cor1}, ${cor2})`,
      border: border || `2px solid ${cor1}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.36,
      color: '#FFFFFF', flexShrink: 0, letterSpacing: -0.5,
    }}>
      {iniciais(nome)}
    </div>
  )
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

function App() {
  const [ranking,  setRanking]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [usuario,  setUsuario]  = useState(null)
  const [aba,      setAba]      = useState('ranking')
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

  const cardStat = {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16, padding: 16, marginBottom: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    color: '#FFFFFF',
  }

  const navBtn = {
    flex: 1, border: 'none', borderRadius: 16,
    padding: 12, fontWeight: 800, cursor: 'pointer',
    color: '#FFFFFF', fontSize: 13,
  }

  const tagPill = (cor) => ({
    background: `rgba(${cor},.1)`,
    border: `1px solid rgba(${cor},.22)`,
    borderRadius: 10, padding: '4px 10px',
    fontSize: 13, fontWeight: 700,
  })

  async function carregarRanking() {
    const { data } = await supabase
      .from('ranking_mensal')
      .select('*')
      .order('total_km', { ascending: false })
    setRanking(data || [])
  }

  async function buscarUsuario(stravaId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('strava_id', stravaId)
      .single()
    if (!error && data) { setUsuario(data); return data }
    return null
  }

  async function carregarCorridasDoMes(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('activities')
      .select('*')
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

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
    setCorridas([])
  }

  return (
    <div translate="no" style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #15182A 0%, #080A14 45%, #05060C 100%)',
      color: 'white', fontFamily: 'Arial, sans-serif',
      padding: 20, paddingBottom: 120,
    }}>
      <div style={{ maxWidth: 430, margin: '0 auto' }}>

        {/* HERO */}
        <header style={{
          position: 'relative',
          minHeight: usuario ? 220 : 500,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          justifyContent: usuario ? 'flex-start' : 'flex-end',
          paddingTop: 48, paddingBottom: 18,
          marginBottom: 8, overflow: 'hidden', borderRadius: 28,
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 220px 320px at 50% 30%, rgba(232,53,74,0.18) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', left: -20, right: -20, bottom: 0, height: 230,
            opacity: 0.055,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(255,255,255,0.45) 38px, rgba(255,255,255,0.45) 40px)',
          }} />
          {!usuario && (
            <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', opacity: 0.95 }}>
              <svg viewBox="0 0 90 90" width="90" height="90">
                <circle cx="52" cy="18" r="10" fill="#E8354A" />
                <line x1="52" y1="28" x2="46" y2="52" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="50" y1="36" x2="30" y2="28" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="50" y1="36" x2="66" y2="46" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="26" y2="66" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="26" y1="66" x2="18" y2="82" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="58" y2="68" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="58" y1="68" x2="74" y2="72" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="14" y1="82" x2="2" y2="82" stroke="#E8354A" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 2, width: '100%', textAlign: 'center' }}>
            <div style={{
              width: 60, height: 60, background: '#E8354A', borderRadius: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 32px rgba(232,53,74,0.40)',
              fontWeight: 900, fontSize: 28, color: '#FFFFFF', letterSpacing: -1,
            }}>RR</div>
            <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: -1.5, color: '#FFFFFF', lineHeight: 1 }}>
              Run<span style={{ color: '#E8354A' }}>Rank</span>
            </div>
            <div style={{ fontSize: 13, color: '#6B7499', marginTop: 6, marginBottom: usuario ? 22 : 42 }}>
              Iguatu corre. Quem lidera?
            </div>
            <a href={stravaAuthUrl} style={{
              width: '100%', height: 54,
              background: 'linear-gradient(135deg, #E8354A, #FF4D63)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              color: '#FFFFFF', textDecoration: 'none',
              fontWeight: 900, fontSize: 15, textTransform: 'uppercase',
              boxShadow: '0 8px 24px rgba(232,53,74,0.35)',
            }}>
              <span style={{
                width: 18, height: 18, background: '#FFFFFF', flexShrink: 0,
                clipPath: 'polygon(30% 0%, 100% 0%, 70% 50%, 100% 50%, 0% 100%, 30% 50%, 0% 50%)',
              }} />
              {loading ? 'Sincronizando...' : usuario ? 'Atualizar com Strava' : 'Entrar com Strava'}
            </a>
            {!usuario && (
              <p style={{ marginTop: 14, fontSize: 11, color: '#6B7499', lineHeight: 1.6 }}>
                Dados importados do Strava. Nenhum GPS ativado.
              </p>
            )}
          </div>
        </header>

        {/* CARD USUÁRIO */}
        {usuario && (
          <div style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20, padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <Avatar src={usuario.profile_picture} nome={usuario.name} size={52} index={0} border="2.5px solid #E8354A" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>{usuario.name}</div>
              <div style={{ color: '#8A91A8', fontSize: 13 }}>
                {minhaPosicao > 0 ? `${minhaPosicao}º no ranking · ` : ''}Conectado via Strava 🚀
              </div>
            </div>
            <button onClick={logout} style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10, color: '#8A91A8', fontSize: 12, padding: '6px 10px',
              cursor: 'pointer', flexShrink: 0,
            }}>Sair</button>
          </div>
        )}

        {/* ABA RANKING */}
        {aba === 'ranking' && (
          <section style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 24, padding: 18, marginBottom: 18,
          }}>
            {!usuario && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                  🏆 Veja quem lidera em Iguatu
                </div>
                <div style={{ color: '#8A91A8', fontSize: 13 }}>
                  Entre com Strava para aparecer no ranking.
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
              <div>
                <span style={{ color: '#E8354A', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
                  {mesAtualLabel()}
                </span>
                <h2 style={{ margin: 0, fontSize: 28, color: '#FFFFFF' }}>Ranking mensal</h2>
              </div>
              <span style={{ fontSize: 22 }}>🏆</span>
            </div>
            {ranking.length === 0 && (
              <p style={{ color: '#8A91A8', textAlign: 'center', padding: '20px 0' }}>
                Nenhum atleta no ranking ainda.
              </p>
            )}
            {ranking.map((atleta, index) => {
              const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`
              const souEu   = atleta.id === usuario?.id
              const [cor1]  = avatarColor(index)
              return (
                <div key={atleta.id} style={{
                  background: souEu
                    ? 'rgba(232,53,74,.09)'
                    : index === 0
                      ? 'linear-gradient(135deg,rgba(255,184,48,.12),rgba(232,53,74,.06))'
                      : 'rgba(255,255,255,.03)',
                  border: souEu
                    ? '1px solid rgba(232,53,74,.3)'
                    : index === 0
                      ? '1px solid rgba(255,184,48,.2)'
                      : '1px solid rgba(255,255,255,.06)',
                  borderRadius: 18, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
                }}>
                  {souEu && (
                    <span style={{
                      position: 'absolute', top: 5, right: 10,
                      fontSize: 9, fontWeight: 900, letterSpacing: 2, color: '#E8354A',
                    }}>VOCÊ</span>
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, background: '#111522',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>{medalha}</div>
                  <Avatar
                    src={atleta.profile_picture}
                    nome={atleta.name}
                    size={42}
                    index={index}
                    border={souEu ? '2px solid #E8354A' : `2px solid ${cor1}40`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 16, fontWeight: 800,
                      color: souEu ? '#FF4D63' : '#FFFFFF',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{atleta.name}</div>
                    <div style={{ color: '#8A91A8', fontSize: 12, marginTop: 1 }}>
                      {atleta.total_corridas} corrida{atleta.total_corridas !== 1 ? 's' : ''} · maior {Number(atleta.maior_corrida_km).toFixed(1)} km
                    </div>
                  </div>
                  <div style={{ color: souEu ? '#FF4D63' : '#E8354A', fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {Number(atleta.total_km).toFixed(1)}
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#8A91A8', marginLeft: 2 }}>km</span>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ABA CORRIDAS */}
        {aba === 'corridas' && (
          <section style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 24, padding: 20, marginBottom: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
              <div>
                <span style={{ color: '#E8354A', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
                  {mesAtualLabel()}
                </span>
                <h2 style={{ color: '#FFFFFF', margin: 0, fontSize: 28 }}>Minhas Corridas</h2>
              </div>
              <span style={{ fontSize: 22 }}>🏃</span>
            </div>
            {!usuario && (
              <p style={{ color: '#8A91A8', textAlign: 'center', padding: '20px 0' }}>
                Entre com o Strava para ver suas corridas.
              </p>
            )}
            {usuario && corridas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A91A8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
                <div>Nenhuma corrida registrada este mês.</div>
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
              return (
                <div key={corrida.id} style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 16, padding: 14, marginBottom: 10,
                }}>
                  <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
                    🏃 {corrida.name || 'Corrida'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ ...tagPill('232,53,74'), color: '#FF4D63' }}>📏 {km} km</span>
                    <span style={{ ...tagPill('255,255,255'), color: '#8A91A8' }}>⏱ {minutos} min</span>
                    {pace && (
                      <span style={{ ...tagPill('255,255,255'), color: '#8A91A8' }}>
                        ⚡ {Math.floor(pace / 60)}:{String(pace % 60).padStart(2, '0')}/km
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#6B7499', marginTop: 8, fontSize: 12 }}>
                    {data} · {corrida.activity_type}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ABA PERFIL */}
        {aba === 'perfil' && (
          <section style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 24, padding: 20, marginBottom: 18,
          }}>
            {!usuario ? (
              <p style={{ color: '#8A91A8', textAlign: 'center', padding: '24px 0' }}>
                Entre com o Strava para ver seu perfil.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <Avatar src={usuario.profile_picture} nome={usuario.name} size={68} index={0} border="3px solid #E8354A" />
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>{usuario.name}</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
                      background: 'rgba(232,53,74,.1)', border: '1px solid rgba(232,53,74,.2)',
                      borderRadius: 100, padding: '4px 12px',
                      fontSize: 13, fontWeight: 700, color: '#FF4D63',
                    }}>
                      🏆 {minhaPosicao > 0 ? `${minhaPosicao}º lugar` : 'Sem corridas ainda'}
                    </div>
                  </div>
                </div>
                <div style={{ color: '#E8354A', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
                  {mesAtualLabel()}
                </div>
                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>KM rodados no mês</span>
                  <strong style={{ color: '#FF4D63', fontSize: 22 }}>
                    {Number(meuRanking?.total_km || 0).toFixed(1)} km
                  </strong>
                </div>
                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Corridas este mês</span>
                  <strong style={{ fontSize: 20 }}>{corridas.length}</strong>
                </div>
                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Maior corrida do mês</span>
                  <strong style={{ color: '#FFB830', fontSize: 18 }}>
                    {Number(meuRanking?.maior_corrida_km || 0).toFixed(1)} km
                  </strong>
                </div>
                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Posição no ranking</span>
                  <strong style={{ color: '#FFB830', fontSize: 22 }}>
                    {minhaPosicao > 0 ? `${minhaPosicao}º` : '-'}
                  </strong>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `🏃 Estou em ${minhaPosicao}º lugar no RunRank Iguatu com ${Number(meuRanking?.total_km || 0).toFixed(1)} km esse mês! Corre lá: ${window.location.origin}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    marginTop: 8,
                    background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                    borderRadius: 14, padding: '14px 20px',
                    color: '#25D366', fontWeight: 800, fontSize: 15, textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>📲</span>
                  Compartilhar no WhatsApp
                </a>
              </>
            )}
          </section>
        )}
      </div>

      {/* NAV BAR */}
      {usuario && (
        <nav style={{
          position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: 430,
          background: 'rgba(18,21,34,.96)', border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 24, padding: 10, display: 'flex', gap: 8,
          backdropFilter: 'blur(16px)', zIndex: 20,
        }}>
          {[
            { id: 'ranking',  label: '🏆 Ranking'  },
            { id: 'corridas', label: '🏃 Corridas' },
            { id: 'perfil',   label: '👤 Perfil'   },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setAba(id)} style={{
              ...navBtn,
              background: aba === id ? 'linear-gradient(135deg,#E8354A,#FF4D63)' : 'transparent',
            }}>{label}</button>
          ))}
        </nav>
      )}
    </div>
  )
}

export default App
