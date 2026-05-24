import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// ─── chave usada no localStorage ────────────────────────────────────────────
const STORAGE_KEY = 'runrank_strava_id'

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

  // ── estilos compartilhados ──────────────────────────────────────────────
  const cardStat = {
    background:    'rgba(255,255,255,.05)',
    border:        '1px solid rgba(255,255,255,.08)',
    borderRadius:  16,
    padding:       16,
    marginBottom:  12,
    display:       'flex',
    justifyContent:'space-between',
    alignItems:    'center',
    color:         '#FFFFFF'
  }

  const navButtonBase = {
    flex:         1,
    border:       'none',
    borderRadius: 16,
    padding:      12,
    fontWeight:   800,
    cursor:       'pointer',
    color:        '#FFFFFF',
    fontSize:     13
  }

  // ── carrega ranking (todos) ─────────────────────────────────────────────
  async function carregarRanking() {
    const { data, error } = await supabase
      .from('ranking_mensal')
      .select('*')
      .order('total_km', { ascending: false })

    if (!error) setRanking(data || [])
  }

  // ── carrega usuário pelo strava_id salvo no localStorage ────────────────
  async function carregarUsuarioPorStravaId(stravaId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('strava_id', stravaId)
      .single()

    if (!error && data) {
      setUsuario(data)
      return data
    }
    return null
  }

  // ── carrega corridas APENAS do usuário logado ───────────────────────────
  async function carregarCorridas(userId) {
    if (!userId) return

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)                      // ← filtra pelo usuário
      .order('start_date', { ascending: false })

    if (!error) setCorridas(data || [])
  }

  // ── processa o callback OAuth do Strava ─────────────────────────────────
  async function processarCallback(code) {
    setLoading(true)
    try {
      const response = await fetch(FUNCTION_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code })
      })

      const result = await response.json()
      console.log('RESULTADO STRAVA:', result)

      // salva o strava_id no localStorage pra persistir a sessão
      if (result?.athlete?.id) {
        localStorage.setItem(STORAGE_KEY, String(result.athlete.id))

        const user = await carregarUsuarioPorStravaId(result.athlete.id)
        if (user) await carregarCorridas(user.id)
      }

      await carregarRanking()
    } catch (err) {
      console.error('Erro no callback:', err)
    } finally {
      // limpa o ?code= da URL sem recarregar a página
      window.history.replaceState({}, document.title, '/')
      setLoading(false)
    }
  }

  // ── ao montar: restaura sessão salva + verifica callback ────────────────
  useEffect(() => {
    async function inicializar() {
      // 1. carrega ranking geral sempre
      await carregarRanking()

      // 2. verifica se veio callback do Strava
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')

      if (code) {
        await processarCallback(code)
        return // processarCallback já cuida do resto
      }

      // 3. sem callback: tenta restaurar sessão do localStorage
      const stravaIdSalvo = localStorage.getItem(STORAGE_KEY)
      if (stravaIdSalvo) {
        const user = await carregarUsuarioPorStravaId(stravaIdSalvo)
        if (user) await carregarCorridas(user.id)
      }
    }

    inicializar()
  }, [])

  // ── dados do usuário no ranking ─────────────────────────────────────────
  const meuRanking    = ranking.find(item => item.id === usuario?.id)
  const minhaPosicao  = ranking.findIndex(item => item.id === usuario?.id) + 1

  // ── logout ──────────────────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUsuario(null)
    setCorridas([])
  }

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div
      translate="no"
      style={{
        minHeight:  '100vh',
        background: 'radial-gradient(circle at top, #15182A 0%, #080A14 45%, #05060C 100%)',
        color:      'white',
        fontFamily: 'Arial, sans-serif',
        padding:    20,
        paddingBottom: 120
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto' }}>

        {/* ── HERO / LOGIN PREMIUM ── */}
        <header
          style={{
            position: 'relative',
            minHeight: usuario ? 250 : 520,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: usuario ? 'flex-start' : 'flex-end',
            paddingTop: 50,
            paddingBottom: usuario ? 12 : 18,
            marginBottom: usuario ? 6 : 4,
            overflow: 'hidden',
            borderRadius: 28
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 220px 320px at 50% 30%, rgba(232,53,74,0.18) 0%, transparent 70%), radial-gradient(ellipse 320px 220px at 80% 10%, rgba(255,122,61,0.10) 0%, transparent 60%)',
              pointerEvents: 'none'
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: -20,
              right: -20,
              bottom: 0,
              height: 230,
              opacity: 0.06,
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(255,255,255,0.45) 38px, rgba(255,255,255,0.45) 40px)'
            }}
          />

          {!usuario && (
            <div
              style={{
                position: 'absolute',
                top: 105,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 92,
                height: 92,
                opacity: 0.95
              }}
            >
              <svg viewBox="0 0 90 90" width="92" height="92">
                <circle cx="52" cy="18" r="10" fill="#E8354A" />
                <line x1="52" y1="28" x2="46" y2="52" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="50" y1="36" x2="30" y2="28" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="50" y1="36" x2="66" y2="46" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="26" y2="66" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="26" y1="66" x2="18" y2="82" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="46" y1="52" x2="58" y2="68" stroke="#E8354A" strokeWidth="6" strokeLinecap="round" />
                <line x1="58" y1="68" x2="74" y2="72" stroke="#E8354A" strokeWidth="5" strokeLinecap="round" />
                <line x1="14" y1="82" x2="2" y2="82" stroke="#E8354A" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                <line x1="10" y1="78" x2="2" y2="78" stroke="#E8354A" strokeWidth="2" strokeLinecap="round" opacity="0.22" />
              </svg>
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 2, width: '100%', textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: '#E8354A',
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 8px 32px rgba(232,53,74,0.40)',
                fontWeight: 900,
                fontSize: 32,
                color: '#FFFFFF',
                letterSpacing: -1
              }}
            >
              RR
            </div>

            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: -1.5,
                color: '#FFFFFF',
                lineHeight: 1
              }}
            >
              Run<span style={{ color: '#E8354A' }}>Rank</span>
            </div>

            <div
              style={{
                fontSize: 14,
                color: '#6B7499',
                marginTop: 8,
                marginBottom: usuario ? 26 : 46,
                letterSpacing: 0.4
              }}
            >
              Iguatu corre. Quem lidera?
            </div>

            <a
              href={stravaAuthUrl}
              style={{
                width: '100%',
                height: 56,
                background: '#E8354A',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 900,
                fontSize: 16,
                textTransform: 'uppercase',
                boxShadow: '0 8px 24px rgba(232,53,74,0.35)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  background: '#FFFFFF',
                  clipPath: 'polygon(30% 0%, 100% 0%, 70% 50%, 100% 50%, 0% 100%, 30% 50%, 0% 50%)',
                  flexShrink: 0
                }}
              />
              {loading ? 'Sincronizando...' : usuario ? 'Atualizar com Strava' : 'Entrar com Strava'}
            </a>

            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                color: '#6B7499',
                lineHeight: 1.6
              }}
            >
              Seus dados de corrida são importados<br />
              diretamente do Strava. Nenhum GPS é ativado.
            </p>
          </div>
        </header>

        {/* ── CARD DO USUÁRIO LOGADO ── */}
        {usuario && (
          <div
            style={{
              background:    'rgba(255,255,255,.04)',
              border:        '1px solid rgba(255,255,255,.08)',
              borderRadius:  24,
              padding:       18,
              marginBottom:  20,
              display:       'flex',
              alignItems:    'center',
              gap:           14
            }}
          >
            {/* foto ou iniciais */}
            {usuario.profile_picture ? (
              <img
                src={
                  usuario.profile_picture.startsWith('http')
                    ? usuario.profile_picture
                    : `https://www.strava.com/${usuario.profile_picture}`
                }
                alt="avatar"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentElement
                    .querySelector('.avatar-fallback')
                    .style.display = 'flex'
                }}
                style={{
                  width:       64,
                  height:      64,
                  borderRadius:'50%',
                  objectFit:   'cover',
                  border:      '2px solid #E8354A',
                  flexShrink:  0
                }}
              />
            ) : null}

            <div
              className="avatar-fallback"
              style={{
                width:          64,
                height:         64,
                borderRadius:   '50%',
                background:     'linear-gradient(135deg, #E8354A, #FF4D63)',
                display:        usuario.profile_picture ? 'none' : 'flex',
                alignItems:     'center',
                justifyContent: 'center',
                border:         '2px solid #E8354A',
                color:          '#FFFFFF',
                fontWeight:     900,
                fontSize:       22,
                flexShrink:     0
              }}
            >
              {usuario.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>
                {usuario.name}
              </div>
              <div style={{ color: '#8A91A8', fontSize: 14 }}>
                Conectado via Strava 🚀
              </div>
            </div>

            {/* botão sair */}
            <button
              onClick={logout}
              style={{
                background:   'rgba(255,255,255,.06)',
                border:       '1px solid rgba(255,255,255,.1)',
                borderRadius: 10,
                color:        '#8A91A8',
                fontSize:     12,
                padding:      '6px 10px',
                cursor:       'pointer',
                flexShrink:   0
              }}
            >
              Sair
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════
            ABA: RANKING
        ════════════════════════════════════════ */}
        {aba === 'ranking' && (
          <section
            style={{
              background:   'rgba(255,255,255,.04)',
              border:       '1px solid rgba(255,255,255,.08)',
              borderRadius: 24,
              padding:      18,
              marginTop:    usuario ? 0 : -8,
              marginBottom: 18
           }}
          >

          {!usuario && (
            <div
              style={{
                marginBottom: 34,
                textAlign: 'center',
                opacity: .92
              }}
            >
              <div
                style={{
                  color:'#FFFFFF',
                  fontWeight:700,
                  fontSize:14,
                  marginBottom:8
                }}
              >
                🏆 Veja quem está liderando na cidade
              </div>

              <div
                style={{
                  color:'#8A91A8',
                  fontSize:13,
                  lineHeight:1.6
                }}
              >
                Entre com Strava para participar do ranking.
              </div>
            </div>
          )}   
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'end',
                marginBottom:   22
              }}
            >
              <div>
                <span style={{ color: '#E8354A', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 }}>
                  {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                </span>
                <h2 style={{ margin: 0, fontSize: 30, color: '#FFFFFF' }}>
                  Ranking mensal
                </h2>
              </div>
              <span style={{ color: '#FFB830', fontSize: 24 }}>🏆</span>
            </div>

            {ranking.length === 0 && (
              <p style={{ color: '#8A91A8' }}>Nenhum atleta no ranking ainda.</p>
            )}

            {ranking.map((atleta, index) => {
              const medalha =
                index === 0 ? '🥇' :
                index === 1 ? '🥈' :
                index === 2 ? '🥉' :
                `${index + 1}º`

              const souEu = atleta.id === usuario?.id

              return (
                <div
                  key={atleta.id}
                  style={{
                    background: souEu
                      ? 'rgba(232,53,74,.1)'
                      : index === 0
                        ? 'linear-gradient(135deg, rgba(255,184,48,.14), rgba(232,53,74,.08))'
                        : 'rgba(255,255,255,.04)',
                    border: souEu
                      ? '1px solid rgba(232,53,74,.35)'
                      : index === 0
                        ? '1px solid rgba(255,184,48,.25)'
                        : '1px solid rgba(255,255,255,.07)',
                    borderRadius: 18,
                    padding:      14,
                    marginBottom: 10,
                    display:      'flex',
                    alignItems:   'center',
                    gap:          12,
                    position:     'relative'
                  }}
                >
                  {/* badge "você" */}
                  {souEu && (
                    <span style={{
                      position:     'absolute',
                      top:          6,
                      right:        10,
                      fontSize:     9,
                      fontWeight:   900,
                      letterSpacing:2,
                      color:        '#E8354A'
                    }}>
                      VOCÊ
                    </span>
                  )}

                  <div
                    style={{
                      width:          42,
                      height:         42,
                      borderRadius:   14,
                      background:     '#111522',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontSize:       22,
                      fontWeight:     900,
                      flexShrink:     0
                    }}
                  >
                    {medalha}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: souEu ? '#FF4D63' : '#FFFFFF' }}>
                      {atleta.name}
                    </div>
                    <div style={{ color: '#8A91A8', fontSize: 13 }}>
                      {atleta.total_corridas} corrida(s) · maior {Number(atleta.maior_corrida_km).toFixed(1)} km
                    </div>
                  </div>

                  <div style={{ color: souEu ? '#FF4D63' : '#FF4D63', fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {Number(atleta.total_km).toFixed(1)} km
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ════════════════════════════════════════
            ABA: CORRIDAS
        ════════════════════════════════════════ */}
        {aba === 'corridas' && (
          <section
            style={{
              background:   'rgba(255,255,255,.04)',
              border:       '1px solid rgba(255,255,255,.08)',
              borderRadius: 24,
              padding:      20,
              marginBottom: 18
            }}
          >
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'end',
                marginBottom:   16
              }}
            >
              <div>
                <span style={{ color: '#E8354A', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 }}>
                  HISTÓRICO
                </span>
                <h2 style={{ color: '#FFFFFF', margin: 0, fontSize: 30 }}>
                  Minhas Corridas
                </h2>
              </div>
              <span style={{ color: '#FFB830', fontSize: 24 }}>🏃</span>
            </div>

            {!usuario && (
              <p style={{ color: '#8A91A8' }}>
                Entre com o Strava para ver suas corridas.
              </p>
            )}

            {usuario && corridas.length === 0 && (
              <p style={{ color: '#8A91A8' }}>Nenhuma corrida encontrada ainda.</p>
            )}

            {corridas.map((corrida) => {
              const km           = (corrida.distance_meters / 1000).toFixed(2)
              const minutos      = Math.round((corrida.moving_time_sec || 0) / 60)
              const dataFormatada= new Date(corrida.start_date).toLocaleDateString('pt-BR')
              const pace         = corrida.moving_time_sec && corrida.distance_meters
                ? Math.round(corrida.moving_time_sec / (corrida.distance_meters / 1000))
                : null
              const paceMin      = pace ? Math.floor(pace / 60) : null
              const paceSeg      = pace ? String(pace % 60).padStart(2, '0') : null

              return (
                <div
                  key={corrida.id}
                  style={{
                    background:   'rgba(255,255,255,.05)',
                    border:       '1px solid rgba(255,255,255,.08)',
                    borderRadius: 18,
                    padding:      16,
                    marginBottom: 12
                  }}
                >
                  <div style={{ color: '#FFFFFF', fontWeight: 900, fontSize: 17, marginBottom: 8 }}>
                    🏃 {corrida.name || 'Corrida'}
                  </div>

                  {/* stats da corrida em linha */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      background:   'rgba(232,53,74,.1)',
                      border:       '1px solid rgba(232,53,74,.2)',
                      borderRadius: 10,
                      padding:      '4px 10px',
                      fontSize:     13,
                      color:        '#FF4D63',
                      fontWeight:   700
                    }}>
                      📏 {km} km
                    </div>

                    <div style={{
                      background:   'rgba(255,255,255,.05)',
                      border:       '1px solid rgba(255,255,255,.08)',
                      borderRadius: 10,
                      padding:      '4px 10px',
                      fontSize:     13,
                      color:        '#8A91A8'
                    }}>
                      ⏱ {minutos} min
                    </div>

                    {pace && (
                      <div style={{
                        background:   'rgba(255,255,255,.05)',
                        border:       '1px solid rgba(255,255,255,.08)',
                        borderRadius: 10,
                        padding:      '4px 10px',
                        fontSize:     13,
                        color:        '#8A91A8'
                      }}>
                        ⚡ {paceMin}:{paceSeg}/km
                      </div>
                    )}
                  </div>

                  <div style={{ color: '#8A91A8', marginTop: 8, fontSize: 12 }}>
                    {dataFormatada} · {corrida.activity_type}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ════════════════════════════════════════
            ABA: PERFIL
        ════════════════════════════════════════ */}
        {aba === 'perfil' && (
          <section
            style={{
              background:   'rgba(255,255,255,.04)',
              border:       '1px solid rgba(255,255,255,.08)',
              borderRadius: 24,
              padding:      20,
              marginBottom: 18
            }}
          >
            {!usuario ? (
              <p style={{ color: '#8A91A8', textAlign: 'center', padding: '20px 0' }}>
                Entre com o Strava para ver seu perfil.
              </p>
            ) : (
              <>
                <h2 style={{ color: '#FFFFFF', marginTop: 0 }}>Meu Perfil</h2>
                <p style={{ color: '#8A91A8', marginTop: -8, marginBottom: 18 }}>
                  {usuario.name}
                </p>

                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Posição no ranking</span>
                  <strong style={{ color: '#FFB830', fontSize: 20 }}>
                    {minhaPosicao > 0 ? `${minhaPosicao}º` : '-'}
                  </strong>
                </div>

                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>KM no mês</span>
                  <strong style={{ color: '#FF4D63', fontSize: 20 }}>
                    {Number(meuRanking?.total_km || 0).toFixed(1)} km
                  </strong>
                </div>

                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Total de corridas</span>
                  <strong>{meuRanking?.total_corridas || 0}</strong>
                </div>

                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Maior corrida</span>
                  <strong>{Number(meuRanking?.maior_corrida_km || 0).toFixed(1)} km</strong>
                </div>

                <div style={cardStat}>
                  <span style={{ color: '#8A91A8' }}>Corridas este mês</span>
                  <strong>{corridas.length}</strong>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* ── NAV BAR FIXA ── */}
      {usuario && (
        <nav
          style={{
            position:        'fixed',
            bottom:          18,
            left:            '50%',
            transform:       'translateX(-50%)',
            width:           '90%',
            maxWidth:        430,
            background:      'rgba(18,21,34,.96)',
            border:          '1px solid rgba(255,255,255,.08)',
            borderRadius:    24,
            padding:         10,
            display:         'flex',
            gap:             8,
            backdropFilter:  'blur(16px)',
            zIndex:          20
          }}
       >
        <button
          onClick={() => setAba('ranking')}
          style={{
            ...navButtonBase,
            background: aba === 'ranking'
              ? 'linear-gradient(135deg,#E8354A,#FF4D63)'
              : 'transparent'
          }}
        >
          🏆 Ranking
        </button>

        <button
          onClick={() => setAba('corridas')}
          style={{
            ...navButtonBase,
            background: aba === 'corridas'
              ? 'linear-gradient(135deg,#E8354A,#FF4D63)'
              : 'transparent'
          }}
        >
          🏃 Corridas
        </button>

        <button
          onClick={() => setAba('perfil')}
          style={{
            ...navButtonBase,
            background: aba === 'perfil'
              ? 'linear-gradient(135deg,#E8354A,#FF4D63)'
              : 'transparent'
          }}
        >
          👤 Perfil
        </button>
      </nav>
    )}
    </div>
  )
}

export default App
