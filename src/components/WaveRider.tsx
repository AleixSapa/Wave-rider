import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/Engine';
import { SoundManager } from '../game/Sound';
import { supabase } from '../lib/supabaseClient';
import { ShoppingCart } from 'lucide-react';

export default function WaveRider() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<'menu' | 'shop' | 'multiplayer_lobby' | 'playing' | 'gameover'>('menu');
  const [distance, setDistance] = useState(0);
  const [combo, setCombo] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [sessionFireCharges, setSessionFireCharges] = useState(0);
  const [sessionShieldTimer, setSessionShieldTimer] = useState(0);
  const [sessionBoostTimer, setSessionBoostTimer] = useState(0);
  const [isShieldReady, setIsShieldReady] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [shieldDurationLevel, setShieldDurationLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [worldRecord, setWorldRecord] = useState(0);
  const [isLoadingPlayerData, setIsLoadingPlayerData] = useState(false);

  const [roomIdInput, setRoomIdInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [isLobbyHost, setIsLobbyHost] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [multiplayerResults, setMultiplayerResults] = useState<any[] | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [equippedBike, setEquippedBike] = useState<string>('default');
  const [hasFireBike, setHasFireBike] = useState<boolean>(false);
  const [hasGatoBike, setHasGatoBike] = useState<boolean>(false);
  const [hasRampeadoraBike, setHasRampeadoraBike] = useState<boolean>(false);
  const [hasSuperBike, setHasSuperBike] = useState<boolean>(false);
  const [maxFireCharges, setMaxFireCharges] = useState<number>(1);
  const [bikePrices, setBikePrices] = useState<Record<string, number>>({
    fire: 500,
    gato: 800,
    rampeadora: 1200,
    super: 2500
  });

  useEffect(() => {
    const fetchPrices = async () => {
        try {
            const { data, error } = await supabase.from('bike_prices').select('*');
            if (!error && data) {
                const prices: Record<string, number> = { ...bikePrices };
                data.forEach((row: any) => {
                    if (row.bike_type && row.price !== undefined) {
                        prices[row.bike_type] = row.price;
                    }
                });
                setBikePrices(prices);
            }
        } catch (err) {
            console.error('Error fetching bike prices:', err);
        }
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    if (gameState === 'menu') {
        const fetchPublicRooms = async () => {
            try {
                const { data } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('state', 'waiting')
                    .eq('is_public', true)
                    .order('created_at', { ascending: false });
                if (data) setPublicRooms(data);
            } catch (err) {
                console.error('Error fetching rooms:', err);
            }
        };
        fetchPublicRooms();
        const interval = setInterval(fetchPublicRooms, 3000);
        return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    // Carregar millor puntuació del món des de Supabase
    const fetchWorldData = async () => {
      try {
        const { data, error } = await supabase
          .from('global_scores')
          .select('score')
          .order('score', { ascending: false })
          .limit(1);
 
        if (!error && data && data.length > 0) {
          setWorldRecord(data[0].score);
        }
      } catch (err) {
        console.error('Error fetching high score:', err);
      }
    };
    
    fetchWorldData();

    // Carregar l'últim nom utilitzat
    const savedName = localStorage.getItem('waverider_last_player');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  // Efecte per carregar automàticament les dades quan el nom canvia
  useEffect(() => {
    if (!playerName || playerName.length < 2) {
      setNameConfirmed(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchPlayerData(playerName);
    }, 600); // Debounce de 600ms

    return () => clearTimeout(timer);
  }, [playerName]);

  const fetchPlayerData = async (rawName: string) => {
    const name = rawName.trim().toUpperCase();
    if (!name || name.length < 2) return;
    setIsLoadingPlayerData(true);
    
    // 1. Carreguem de la cache local per immediatesa
    const cached = localStorage.getItem(`waverider_user_${name}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setHighScore(data.score || 0);
        setTotalCoins(data.coins || 0);
        setSpeedLevel(data.speed_level || 1);
        setShieldDurationLevel(data.shield_duration_level || 1);
        setHasFireBike(!!data.has_fire_bike);
        setHasGatoBike(!!data.has_gato_bike);
        setHasRampeadoraBike(!!data.has_rampeadora_bike);
        setHasSuperBike(!!data.has_super_bike);
        setMaxFireCharges(data.max_fire_charges || 1);
        setEquippedBike(data.equipped_bike || 'default');
        setNameConfirmed(true);
      } catch (e) {
        console.error("Error cache:", e);
      }
    }

    // 2. Sincronitzem amb Supabase
    try {
      const { data, error } = await supabase
        .from('global_scores')
        .select('*')
        .eq('player_name', name)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error("Supabase fetch error:", error);
        if (cached) setNameConfirmed(true);
        return;
      }

      if (data && data.length > 0) {
        const row = data[0];
        setHighScore(row.score || 0);
        setTotalCoins(row.coins || 0);
        setSpeedLevel(row.speed_level || 1);
        setShieldDurationLevel(row.shield_duration_level || 1);
        setHasFireBike(!!row.has_fire_bike);
        setHasGatoBike(!!row.has_gato_bike);
        setHasRampeadoraBike(!!row.has_rampeadora_bike);
        setHasSuperBike(!!row.has_super_bike);
        setMaxFireCharges(row.max_fire_charges || 1);
        // Comprovar si existeix la columna equipped_bike en la resposta
        const eqBike = row.equipped_bike || 'default';
        setEquippedBike(eqBike);
        setNameConfirmed(true);
        
        // Actualitzem cache
        const userData = {
          score: row.score || 0,
          coins: row.coins || 0,
          speed_level: row.speed_level || 1,
          has_fire_bike: row.has_fire_bike || false,
          has_gato_bike: row.has_gato_bike || false,
          has_rampeadora_bike: row.has_rampeadora_bike || false,
          has_super_bike: row.has_super_bike || false,
          max_fire_charges: row.max_fire_charges || 1,
          shield_duration_level: row.shield_duration_level || 1,
          equipped_bike: eqBike
        };
        localStorage.setItem(`waverider_user_${name}`, JSON.stringify(userData));
      } else {
        // Usuari nou
        if (!cached) {
          setHighScore(0);
          setTotalCoins(0);
          setSpeedLevel(1);
          setShieldDurationLevel(1);
          setMaxFireCharges(1);
          setHasFireBike(false);
          setHasGatoBike(false);
          setHasRampeadoraBike(false);
          setHasSuperBike(false);
          setEquippedBike('default');
        }
        setNameConfirmed(true);
      }
      localStorage.setItem('waverider_last_player', name);
    } catch(e) {
      console.error("Unexpected error in fetch:", e);
      if (cached) setNameConfirmed(true);
    } finally {
      setIsLoadingPlayerData(false);
    }
  };

  const saveScoreToSupabase = async (finalDistance: number, coinsToAdd: number, pName: string, pSpeed: number) => {
    if (!pName || pName === 'Anonymous') return;
    
    try {
      // 1. Obtenir dades actuals per seguretat
      const { data } = await supabase.from('global_scores').select('*').eq('player_name', pName).limit(1);
      const existing = data && data.length > 0 ? data[0] : null;

      const newTotalCoins = (existing?.coins || 0) + coinsToAdd;
      const bestScore = Math.max(finalDistance, existing?.score || 0);

      // Optimistic update
      setTotalCoins(newTotalCoins);
      setHighScore(bestScore);
      if (bestScore > worldRecord) setWorldRecord(bestScore);

      const updatePayload: any = {
        player_name: pName,
        score: bestScore,
        coins: newTotalCoins,
        speed_level: pSpeed,
        has_fire_bike: hasFireBike,
        has_gato_bike: hasGatoBike,
        has_rampeadora_bike: hasRampeadoraBike,
        has_super_bike: hasSuperBike,
        max_fire_charges: maxFireCharges,
        shield_duration_level: shieldDurationLevel,
        updated_at: new Date().toISOString()
      };

      // Només afegim equipped_bike si sabem que existeix o si volem provar
      // Per evitar errors 400 si la columna no existeix, provem de guardar primer sense ella
      // o detectem si la taula la té. Per ara, la tractem com opcional en el payload.
      if (equippedBike !== 'default') {
          updatePayload.equipped_bike = equippedBike;
      }

      // 2. Intentar guardar (Insert o Update)
      let saveError;
      if (existing) {
        const { error } = await supabase.from('global_scores').update(updatePayload).eq('player_name', pName);
        saveError = error;
      } else {
        const { error } = await supabase.from('global_scores').insert([updatePayload]);
        saveError = error;
      }

      // 3. Si falla per columna inexistent (codi 42703 a Postgres), reintentem sense equipped_bike
      if (saveError && (saveError.message?.includes('equipped_bike') || saveError.code === '42703')) {
          console.warn("Retrying save without 'equipped_bike' column...");
          delete updatePayload.equipped_bike;
          if (existing) {
            await supabase.from('global_scores').update(updatePayload).eq('player_name', pName);
          } else {
            await supabase.from('global_scores').insert([updatePayload]);
          }
      } else if (saveError) {
          console.error("Save error:", saveError);
      }

      // 4. Sincronitzar cache local
      localStorage.setItem(`waverider_user_${pName}`, JSON.stringify({
          score: bestScore,
          coins: newTotalCoins,
          speed_level: pSpeed,
          has_fire_bike: hasFireBike,
          has_gato_bike: hasGatoBike,
          has_rampeadora_bike: hasRampeadoraBike,
          has_super_bike: hasSuperBike,
          max_fire_charges: maxFireCharges,
          shield_duration_level: shieldDurationLevel,
          equipped_bike: equippedBike
      }));

    } catch (err) {
      console.error('Critical error saving to Supabase:', err);
    }
  };

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.playerName = playerName || 'Anonymous';
        engineRef.current.player.equippedBike = equippedBike;
        engineRef.current.player.maxBikeCharges = maxFireCharges;
        // Need to wait for fetchPlayerData to set the correct speed
    }
  }, [playerName, equippedBike, maxFireCharges]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setPlayerBaseSpeed(200 + ((speedLevel || 1) - 1) * 20);
        engineRef.current.player.shieldMaxDuration = 10.0 + ((shieldDurationLevel || 1) - 1) * 1.0;
    }
  }, [speedLevel, shieldDurationLevel]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.gameState = gameState;
    }
  }, [gameState]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // We only want to instantiate the engine once. Wait, React strict mode runs this twice,
    // so we should be careful to clean up inner subscriptions or use a flag.
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.setPlayerBaseSpeed(200 + ((speedLevel || 1) - 1) * 20);
    engine.playerName = playerName || 'Anonymous';
    engine.player.equippedBike = equippedBike;
    engine.player.maxBikeCharges = maxFireCharges;

    engine.onScoreUpdate = (d, c, sp, cn, fc, st, sr, bt) => {
      setDistance(d);
      setCombo(c);
      setSpeed(sp);
      setSessionCoins(cn);
      setSessionFireCharges(fc);
      setSessionShieldTimer(st);
      setIsShieldReady(sr);
      setSessionBoostTimer(bt);
    };

    engine.onGameOver = async (finalDistance, allPlayersData, coinsCollected = 0) => {
      setGameState('gameover');
      
      const pName = engine.playerName || 'Anonymous';
      const pSpeed = (engine.player.baseSpeed - 200) / 20 + 1;

      if (!allPlayersData) {
          // Single player
          setHighScore(prev => Math.max(prev, finalDistance));
          
          await saveScoreToSupabase(finalDistance, coinsCollected, pName, pSpeed);
      } else {
          // Multiplayer
          const sorted = Object.values(allPlayersData).sort((a: any, b: any) => {
              return (b.distance) - (a.distance);
          });
          setMultiplayerResults(sorted);
          await saveScoreToSupabase(finalDistance, coinsCollected, pName, pSpeed);
      }
    };

    engine.onLobbyUpdate = (roomId, players, isHost) => {
        setCurrentRoom(roomId);
        setLobbyPlayers(Object.values(players));
        setIsLobbyHost(isHost);
    };

    engine.onGameCountdown = (startTime) => {
        const updateCount = () => {
             const left = Math.ceil((startTime - Date.now()) / 1000);
             if (left > 0) {
                 setCountdown(left);
                 setTimeout(updateCount, 100);
             } else {
                 setCountdown(null);
             }
        }
        updateCount();
    }

    engine.start();

    // Check periodically for state changes
    const interval = setInterval(() => {
        setGameState(engine.gameState);
        if (engine.gameState === 'multiplayer_lobby') {
            setLobbyPlayers(Object.values(engine.network.players));
        }
    }, 100);

    return () => {
      engine.stop();
      engine.network.socket?.disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleStartSinglePlayer = () => {
    SoundManager.init();
    if (engineRef.current) {
      engineRef.current.startGame(false);
      setGameState('playing');
      setMultiplayerResults(null);
    }
  };

  const handleCreateRoom = async (isPublic: boolean) => {
    SoundManager.init();
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await supabase.from('rooms').insert([{ 
            id: newRoomId, 
            host_name: playerName || 'Anonymous', 
            is_public: isPublic, 
            state: 'waiting',
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.error('Error creating room in Supabase:', err);
    }
    engineRef.current?.createMultiplayerRoom(newRoomId);
  };

  const handleJoinRoom = (roomIdToJoin: string) => {
    SoundManager.init();
    if (roomIdToJoin) {
        engineRef.current?.joinMultiplayerRoom(roomIdToJoin);
    }
  };

  const handleStartMultiplayer = async () => {
    if (currentRoom) {
      await supabase.from('rooms').update({ state: 'playing' }).eq('id', currentRoom);
    }
    engineRef.current?.startMultiplayerGame();
  };

  const savePlayerStateToSupabase = async (coins: number, speed_lvl: number, has_fire: boolean, has_gato: boolean, has_ramp: boolean, has_super: boolean, max_charges: number, shield_lvl: number, eq_bike: string) => {
      const pName = playerName || 'Anonymous';
      if (pName === 'Anonymous') return;

      try {
          const updatePayload: any = {
              player_name: pName,
              score: highScore, 
              coins: coins,
              speed_level: speed_lvl,
              has_fire_bike: has_fire,
              has_gato_bike: has_gato,
              has_rampeadora_bike: has_ramp,
              has_super_bike: has_super,
              max_fire_charges: max_charges,
              shield_duration_level: shield_lvl,
              updated_at: new Date().toISOString()
          };

          // Intentem afegir equipped_bike si no és default per seguretat
          if (eq_bike !== 'default') updatePayload.equipped_bike = eq_bike;

          // Sincronitzar cache local
          localStorage.setItem(`waverider_user_${pName}`, JSON.stringify({
              score: highScore,
              coins: coins,
              speed_level: speed_lvl,
              has_fire_bike: has_fire,
              has_gato_bike: has_gato,
              has_rampeadora_bike: has_ramp,
              max_fire_charges: max_charges,
              shield_duration_level: shield_lvl,
              equipped_bike: eq_bike
          }));

          // 1. Cercar si ja existeix
          const { data: existing } = await supabase.from('global_scores').select('player_name').eq('player_name', pName).limit(1);
          
          // 2. Guardar (Upsert fallback manual)
          let saveError;
          if (existing && existing.length > 0) {
              const { error } = await supabase.from('global_scores').update(updatePayload).eq('player_name', pName);
              saveError = error;
          } else {
              const { error } = await supabase.from('global_scores').insert([updatePayload]);
              saveError = error;
          }

          // 3. Fallback per columna equipped_bike inexistent
          if (saveError && (saveError.message?.includes('equipped_bike') || saveError.code === '42703')) {
              delete updatePayload.equipped_bike;
              if (existing && existing.length > 0) {
                  await supabase.from('global_scores').update(updatePayload).eq('player_name', pName);
              } else {
                  await supabase.from('global_scores').insert([updatePayload]);
              }
          }
      } catch (err) {
          console.error('Error saving player data to Supabase:', err);
      }
  };

  const handleBuyBike = async (bikeType: 'fire' | 'rampeadora' | 'gato' | 'super') => {
      const price = bikePrices[bikeType] || 0;

      if (totalCoins >= price) {
          SoundManager.init();
          const newCoins = totalCoins - price;
          let newHasFire = hasFireBike;
          let newHasRamp = hasRampeadoraBike;
          let newHasGato = hasGatoBike;
          let newHasSuper = hasSuperBike;
          
          if (bikeType === 'fire') newHasFire = true;
          if (bikeType === 'rampeadora') newHasRamp = true;
          if (bikeType === 'gato') newHasGato = true;
          if (bikeType === 'super') newHasSuper = true;
          
          setTotalCoins(newCoins);
          setHasFireBike(newHasFire);
          setHasRampeadoraBike(newHasRamp);
          setHasGatoBike(newHasGato);
          setHasSuperBike(newHasSuper);
          
          await savePlayerStateToSupabase(newCoins, speedLevel, newHasFire, newHasGato, newHasRamp, newHasSuper, maxFireCharges, shieldDurationLevel, equippedBike);
      }
  };

  const handleUpgradeSpeed = async () => {
      const cost = speedLevel * 10;
      if (totalCoins >= cost) {
         SoundManager.init();
         const newLevel = speedLevel + 1;
         const newCoins = totalCoins - cost;
         setSpeedLevel(newLevel);
         setTotalCoins(newCoins);
         if (engineRef.current) {
            engineRef.current.setPlayerBaseSpeed(200 + (newLevel - 1) * 20);
         }
         await savePlayerStateToSupabase(newCoins, newLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, equippedBike);
      }
  };

  const handleUpgradeShield = async () => {
      const cost = 200;
      if (totalCoins >= cost) {
          SoundManager.init();
          const newLevel = shieldDurationLevel + 1;
          const newCoins = totalCoins - cost;
          setShieldDurationLevel(newLevel);
          setTotalCoins(newCoins);
          if (engineRef.current) {
              engineRef.current.player.shieldMaxDuration = 10.0 + (newLevel - 1) * 1.0;
          }
          await savePlayerStateToSupabase(newCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, newLevel, equippedBike);
      }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-blue-900 touch-none">
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
      />

      {/* HUD */}
      {gameState === 'playing' && (
        <>
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none select-none text-white font-bold drop-shadow-md z-10">
            <div className="flex flex-col gap-2">
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-xs uppercase tracking-widest text-cyan-200 font-bold mb-1">Distance</div>
                <div className="text-5xl font-black tabular-nums">{distance} <span className="text-xl">m</span></div>
              </div>
              <div className="bg-yellow-500/80 backdrop-blur-md rounded-xl px-4 py-2 border border-white/20 flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-300 rounded-full border border-white"></div>
                <div className="text-xl font-black tabular-nums">{sessionCoins}</div>
              </div>
              <div className="bg-cyan-600/80 backdrop-blur-md rounded-xl px-4 py-2 border border-white/20 flex flex-col items-center gap-1">
                  <div className="text-[10px] uppercase tracking-widest text-white/80 font-bold leading-none">Càrregues</div>
                  <div className="text-lg font-black tabular-nums text-white leading-none">{sessionFireCharges} restants</div>
                </div>
              {equippedBike === 'fire' && (isShieldReady || sessionShieldTimer > 0) && (
                <div className={`backdrop-blur-md rounded-xl px-4 py-2 border flex flex-col items-center gap-1 transition-colors duration-300 ${
                  sessionShieldTimer > 0 
                  ? 'bg-blue-600/90 border-blue-400/50 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.6)]' 
                  : 'bg-cyan-600/80 border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                }`}>
                  <div className={`text-[10px] uppercase tracking-widest font-bold leading-none ${
                    sessionShieldTimer > 0 ? 'text-blue-100' : 'text-cyan-100'
                  }`}>
                    {sessionShieldTimer > 0 ? 'Cúpula Active' : 'Cúpula Ready'}
                  </div>
                  <div className="text-xl font-black tabular-nums text-white leading-none">
                    {(sessionShieldTimer > 0 ? sessionShieldTimer : (10.0 + (shieldDurationLevel - 1) * 1.0)).toFixed(1)}s
                  </div>
                  {sessionShieldTimer <= 0 && (
                    <div className="text-[8px] uppercase text-cyan-200/80 font-bold">Land or Hit to activate</div>
                  )}
                </div>
              )}
              {equippedBike === 'super' && sessionBoostTimer > 0 && (
                <div className="backdrop-blur-md rounded-xl px-4 py-2 border border-yellow-400 bg-yellow-500/90 shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-pulse flex flex-col items-center gap-1">
                  <div className="text-[10px] uppercase tracking-widest font-black text-black leading-none">
                    SUPER MOTO ACTIVE
                  </div>
                  <div className="text-2xl font-black tabular-nums text-black leading-none">
                    {sessionBoostTimer.toFixed(1)}s
                  </div>
                  <div className="text-[8px] uppercase text-black/70 font-bold">Protection & Boost</div>
                </div>
              )}
              {combo > 1 && (
                <div className="bg-orange-500 rounded-xl p-3 border-2 border-white flex items-center gap-3 animate-pulse">
                  <span className="text-3xl font-black">X{combo}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/20 text-right">
                <div className="text-xs uppercase tracking-widest text-cyan-200 font-bold mb-1">Speed</div>
                <div className="text-4xl font-black italic">{speed} <span className="text-xl uppercase">km/h</span></div>
                <div className="w-full h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all duration-100" style={{ width: `${Math.min(100, Math.max(0, (speed / 800) * 100))}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-12 pointer-events-none select-none text-white font-bold z-10">
            <div className="flex flex-col items-center opacity-70">
              <div className="w-16 h-12 border-2 border-white rounded-lg flex items-center justify-center font-bold">SPACE</div>
              <div className="text-[10px] mt-2 uppercase font-black tracking-widest">Hold to Flip</div>
            </div>
          </div>

          <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none text-white z-10 hidden md:block">
            <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-xs font-bold tracking-tighter shadow-lg flex items-center gap-2">
              <span>TOTAL COINS:</span>
              <div className="w-3 h-3 bg-yellow-300 rounded-full border border-white ml-1"></div>
              <span className="text-yellow-300 tabular-nums font-mono">{totalCoins}</span>
            </div>
          </div>
        </>
      )}

      {/* Main Menu overlay */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20 select-none">
            <h1 className="text-6xl md:text-8xl font-black italic text-cyan-400 mb-2 tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] text-center leading-none">
              WAVE <span className="text-white">RIDER</span>
            </h1>
            <div className="bg-black/40 backdrop-blur-md rounded-xl px-4 py-2 border border-white/20 mb-8 mt-4 shadow-xl flex gap-4">
              <div className="flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-widest text-cyan-200 font-bold mb-1 text-center">Rècord Món</div>
                <p className="text-xl font-black text-white tabular-nums drop-shadow text-center">{worldRecord}m</p>
              </div>
              <div className="w-px bg-white/20 h-auto"></div>
              <div className="flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-1 text-center">Distància Propi</div>
                <p className="text-xl font-black text-white tabular-nums drop-shadow text-center">{highScore}m</p>
              </div>
              <div className="w-px bg-white/20 h-auto"></div>
              <div className="flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-widest text-yellow-300 font-bold mb-1 text-center">Monedes</div>
                <p className="text-xl font-black text-yellow-400 tabular-nums drop-shadow text-center">{totalCoins}</p>
              </div>
            </div>

            <div className="mb-4 w-full max-w-sm">
                <input 
                    type="text" 
                    placeholder="ESCRIU EL TEU NOM" 
                    className="w-full bg-black/60 border border-white/30 rounded-lg px-4 py-3 text-white font-bold text-center uppercase focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 placeholder:text-white/20"
                    value={playerName}
                    onChange={e => {
                      setPlayerName(e.target.value.toUpperCase());
                      setNameConfirmed(false);
                    }}
                    maxLength={15}
                />
            </div>
            
            {nameConfirmed ? (
              <div className="flex flex-col items-center gap-6 mt-2 w-full max-w-md h-[400px] overflow-y-auto pb-8 scrollbar-hide">
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-6 py-2 mb-2 flex items-center justify-between w-full animate-in fade-in zoom-in duration-500">
                   <p className="text-cyan-400 font-bold text-sm uppercase tracking-[0.2em]">Sessió: {playerName}</p>
                   <button 
                    onClick={() => {
                      setPlayerName('');
                      setNameConfirmed(false);
                      localStorage.removeItem('waverider_last_player');
                    }}
                    className="text-[10px] text-white/40 hover:text-white uppercase font-bold transition-colors"
                   >
                     Sortir
                   </button>
                </div>
                <button 
                  onClick={handleStartSinglePlayer}
                  className="w-full shrink-0 py-4 bg-gradient-to-b from-cyan-400 to-blue-600 text-white font-black text-2xl italic tracking-wider rounded-lg border-b-4 border-blue-800 hover:translate-y-1 hover:border-b-0 transition-all shadow-xl active:scale-95 cursor-pointer"
                >
                  PRACTICE MODE
                </button>

                <button 
                  onClick={() => {
                    if (engineRef.current) engineRef.current.gameState = 'shop';
                    setGameState('shop');
                  }}
                  className="w-full shrink-0 flex items-center justify-center bg-gradient-to-r gap-2 from-yellow-500 to-orange-500 text-black font-black text-xl italic py-3 rounded-xl shadow-lg border-b-4 border-orange-700 hover:translate-y-1 hover:border-b-0 transition-all active:scale-95 cursor-pointer"
                >
                  <ShoppingCart className="w-6 h-6" />
                  SHOP (BOTIGA)
                </button>

                <div className="w-full shrink-0 flex flex-col items-center bg-black/40 backdrop-blur-sm border border-white/20 p-6 rounded-xl">
                    <h3 className="text-cyan-300 font-bold text-center mb-4 uppercase tracking-widest text-sm">Multiplayer Racing</h3>
                    <div className="flex flex-col gap-4">
                        <button 
                          onClick={() => handleCreateRoom(true)}
                          className="w-full py-3 bg-gradient-to-b from-green-400 to-green-600 text-white font-bold text-xl italic rounded-lg border-b-4 border-green-800 hover:translate-y-1 hover:border-b-0 transition-all shadow-xl active:scale-95 cursor-pointer"
                        >
                          CREATE PUBLIC ROOM
                        </button>

                        <button 
                          onClick={() => handleCreateRoom(false)}
                          className="w-full py-2 bg-black/60 text-white/80 font-bold text-sm uppercase rounded-lg border border-white/20 hover:bg-white/10 transition-all cursor-pointer"
                        >
                          Private Room (Code)
                        </button>
                        
                        <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="ROOM CODE" 
                              className="w-2/3 bg-black/60 border border-white/30 rounded-lg px-4 py-2 text-white font-bold text-center uppercase focus:outline-none focus:border-cyan-400"
                              value={roomIdInput}
                              onChange={e => setRoomIdInput(e.target.value.toUpperCase())}
                              maxLength={6}
                            />
                            <button 
                              onClick={() => handleJoinRoom(roomIdInput)}
                              className="w-1/3 py-2 bg-gradient-to-b from-yellow-400 to-orange-500 text-white font-bold text-lg italic rounded-lg border-b-4 border-orange-700 hover:translate-y-1 hover:border-b-0 transition-all shadow-xl active:scale-95 cursor-pointer"
                            >
                                JOIN
                            </button>
                        </div>
                    </div>

                    {publicRooms.length > 0 && (
                        <div className="mt-6 w-full">
                            <h4 className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Public Rooms</h4>
                            <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                                {publicRooms.map(room => (
                                    <div key={room.id} className="bg-white/5 border border-white/10 rounded-lg p-2 px-3 flex justify-between items-center hover:bg-white/10 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-sm">{room.host_name}'s Room</span>
                                        </div>
                                        <button 
                                            onClick={() => handleJoinRoom(room.id)}
                                            className="bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-cyan-400 cursor-pointer"
                                        >
                                            JOIN
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-white/80 text-sm mt-4 border border-white/20 p-5 rounded-xl bg-black/40 backdrop-blur-sm shadow-xl text-center flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 border border-white rounded flex items-center justify-center font-bold text-[10px]">SPACE</div>
                      <p className="uppercase text-xs font-bold tracking-widest text-left">Hold in air to flip</p>
                    </div>
                </div>
              </div>
            ) : (
                <div className="mt-8 text-center animate-pulse">
                    <p className="text-cyan-400 text-sm font-black uppercase tracking-widest">
                        {playerName ? 'Fes clic a "Carregar" per començar!' : 'Escriu el teu nom per jugar!'}
                    </p>
                </div>
            )}
        </div>
      )}

      {/* Shop Overlay */}
      {gameState === 'shop' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-lg z-30 select-none overflow-y-auto py-10">
            <h2 className="text-4xl md:text-5xl font-black text-yellow-500 italic mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                <ShoppingCart className="inline-block w-10 h-10 mr-3 -translate-y-1" />
                LA BOTIGA
            </h2>
            <div className="bg-black/60 px-6 py-2 rounded-full border border-yellow-500/30 mb-8 flex items-center gap-3">
               <span className="text-white/60 font-bold text-sm uppercase tracking-widest">Total Coins</span>
               <span className="text-yellow-400 font-black text-2xl tabular-nums">{totalCoins}</span>
            </div>

            <div className="flex flex-col gap-6 w-full max-w-2xl px-4 mt-4 pb-20">
                {/* SECCIÓ MOTOS */}
                <h3 className="text-white font-black text-2xl uppercase tracking-widest border-b-2 border-white/10 pb-2">Les Teves Motos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Moto Bàsica */}
                    <div className={`border ${equippedBike === 'default' ? 'border-cyan-400 bg-cyan-900/20' : 'border-white/10 bg-white/5'} rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors`}>
                        <div className="text-center">
                            <h4 className="text-white font-bold text-lg uppercase">Moto Bàsica</h4>
                            <p className="text-white/40 text-[10px]">Sense habilitats especials.</p>
                        </div>
                        <button 
                            onClick={async () => {
                                setEquippedBike('default');
                                await savePlayerStateToSupabase(totalCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, 'default');
                            }}
                            className={`${equippedBike === 'default' ? 'bg-cyan-400 text-black' : 'bg-white/20 text-white hover:bg-white/30'} font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full`}
                        >
                            {equippedBike === 'default' ? 'EQUIPADA' : 'EQUIPAR'}
                        </button>
                    </div>

                    {/* Moto Fuego */}
                    <div className={`border ${equippedBike === 'fire' ? 'border-orange-500 bg-orange-900/20' : 'border-white/10 bg-white/5'} rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors`}>
                        <div className="text-center">
                            <h4 className="text-orange-500 font-bold text-lg uppercase">Moto Fuego</h4>
                            <p className="text-white/40 text-[10px]">Turbo de foc (Enter).</p>
                        </div>
                        {hasFireBike ? (
                            <button 
                                onClick={async () => {
                                    setEquippedBike('fire');
                                    await savePlayerStateToSupabase(totalCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, 'fire');
                                }}
                                className={`${equippedBike === 'fire' ? 'bg-orange-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'} font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full`}
                            >
                                {equippedBike === 'fire' ? 'EQUIPADA' : 'EQUIPAR'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleBuyBike('fire')}
                                disabled={totalCoins < (bikePrices.fire || 500)}
                                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full"
                            >
                                COMPRAR ({bikePrices.fire || 500})
                            </button>
                        )}
                    </div>

                    {/* Moto Gato */}
                    <div className={`border ${equippedBike === 'gato' ? 'border-green-500 bg-green-900/20' : 'border-white/10 bg-white/5'} rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors`}>
                        <div className="text-center">
                            <h4 className="text-green-500 font-bold text-lg uppercase">Moto Gato</h4>
                            <p className="text-white/40 text-[10px]">Gran salt vertical (Enter).</p>
                        </div>
                        {hasGatoBike ? (
                            <button 
                                onClick={async () => {
                                    setEquippedBike('gato');
                                    await savePlayerStateToSupabase(totalCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, 'gato');
                                }}
                                className={`${equippedBike === 'gato' ? 'bg-green-500 text-black' : 'bg-white/20 text-white hover:bg-white/30'} font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full`}
                            >
                                {equippedBike === 'gato' ? 'EQUIPADA' : 'EQUIPAR'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleBuyBike('gato')}
                                disabled={totalCoins < (bikePrices.gato || 800)}
                                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full"
                            >
                                COMPRAR ({bikePrices.gato || 800})
                            </button>
                        )}
                    </div>

                    {/* Super Moto */}
                    <div className={`border ${equippedBike === 'super' ? 'border-purple-500 bg-purple-900/20' : 'border-white/10 bg-white/5'} rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors`}>
                        <div className="text-center">
                            <h4 className="text-purple-500 font-bold text-lg uppercase">Super Moto</h4>
                            <p className="text-white/40 text-[10px]">Salt diagonal + Foc 30s (Enter).</p>
                        </div>
                        {hasSuperBike ? (
                            <button 
                                onClick={async () => {
                                    setEquippedBike('super');
                                    await savePlayerStateToSupabase(totalCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, 'super');
                                }}
                                className={`${equippedBike === 'super' ? 'bg-purple-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'} font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full`}
                            >
                                {equippedBike === 'super' ? 'EQUIPADA' : 'EQUIPAR'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleBuyBike('super')}
                                disabled={totalCoins < (bikePrices.super || 2500)}
                                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full"
                            >
                                COMPRAR ({bikePrices.super || 2500})
                            </button>
                        )}
                    </div>

                    {/* Rampeadora */}
                    <div className={`border ${equippedBike === 'rampeadora' ? 'border-yellow-400 bg-yellow-900/20' : 'border-white/10 bg-white/5'} rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors`}>
                        <div className="text-center">
                            <h4 className="text-yellow-400 font-bold text-lg uppercase">Rampeadora</h4>
                            <p className="text-white/40 text-[10px]">Genera rampa x15 (Enter).</p>
                        </div>
                        {hasRampeadoraBike ? (
                            <button 
                                onClick={async () => {
                                    setEquippedBike('rampeadora');
                                    await savePlayerStateToSupabase(totalCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, maxFireCharges, shieldDurationLevel, 'rampeadora');
                                }}
                                className={`${equippedBike === 'rampeadora' ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white hover:bg-white/30'} font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full`}
                            >
                                {equippedBike === 'rampeadora' ? 'EQUIPADA' : 'EQUIPAR'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleBuyBike('rampeadora')}
                                disabled={totalCoins < (bikePrices.rampeadora || 1200)}
                                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-lg cursor-pointer transition-colors w-full"
                            >
                                COMPRAR ({bikePrices.rampeadora || 1200})
                            </button>
                        )}
                    </div>
                </div>

                <h3 className="text-white font-black text-2xl uppercase tracking-widest border-b-2 border-white/10 pb-2 mt-4">Millores d'Atributs</h3>
                
                {/* Upgrade Speed */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                        <h3 className="text-cyan-400 font-bold text-xl uppercase tracking-widest mb-1">Upgrade Speed</h3>
                        <p className="text-white/60 text-sm">Aumenta la velocitat base de la moto.</p>
                        <p className="text-white font-bold text-sm mt-2 bg-black/40 px-3 py-1 rounded">Current: {200 + (speedLevel - 1) * 20} km/h</p>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                        <button 
                            onClick={handleUpgradeSpeed}
                            disabled={totalCoins < (speedLevel * 10)}
                            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black px-6 py-3 rounded-lg cursor-pointer transition-colors shadow-md w-full sm:w-auto"
                        >
                            UPGRADE
                        </button>
                        <span className="text-yellow-400 font-bold mt-2 text-sm text-center">{speedLevel * 10} COINS</span>
                    </div>
                </div>

                {/* Upgrade Shield - Only visible if hasFireBike */}
                {hasFireBike && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                          <h3 className="text-blue-400 font-bold text-xl uppercase tracking-widest mb-1">Cúpula Protectora</h3>
                          <p className="text-white/60 text-sm">Afegeix 1 segon de durada a la cúpula quan fas un doble backflip.</p>
                          <p className="text-white font-bold text-sm mt-2 bg-black/40 px-3 py-1 rounded">Current Duration: {10.0 + (shieldDurationLevel - 1) * 1.0} seconds</p>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                          <button 
                              onClick={handleUpgradeShield}
                              disabled={totalCoins < 200}
                              className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-3 rounded-lg cursor-pointer transition-colors shadow-md w-full sm:w-auto"
                          >
                              UPGRADE
                          </button>
                          <span className="text-yellow-400 font-bold mt-2 text-sm text-center">200 COINS</span>
                      </div>
                  </div>
                )}

                {/* Extra Charges Upgrade  */}
                {(hasFireBike || hasGatoBike || hasRampeadoraBike) && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                            <h3 className="text-yellow-400 font-bold text-xl uppercase tracking-widest mb-1">Passi de Càrregues Extra</h3>
                            <p className="text-white/60 text-sm">Afegeix 1 ús addicional per carrera a la teva moto equipada.</p>
                            <p className="text-white font-bold text-sm mt-2 bg-black/40 px-3 py-1 rounded">Usos actuals: {maxFireCharges}</p>
                        </div>
                        <div className="flex flex-col items-center shrink-0">
                            <button 
                                onClick={async () => {
                                    if (totalCoins >= 150) {
                                        const newCoins = totalCoins - 150;
                                        setTotalCoins(newCoins);
                                        const newMax = maxFireCharges + 1;
                                        setMaxFireCharges(newMax);
                                        SoundManager.init();
                                        await savePlayerStateToSupabase(newCoins, speedLevel, hasFireBike, hasGatoBike, hasRampeadoraBike, hasSuperBike, newMax, shieldDurationLevel, equippedBike);
                                    }
                                }}
                                disabled={totalCoins < 150}
                                className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black px-6 py-3 rounded-lg cursor-pointer transition-colors shadow-md w-full sm:w-auto"
                            >
                                MILLORAR
                            </button>
                            <span className="text-yellow-400 font-bold mt-2 text-sm text-center">150 COINS</span>
                        </div>
                    </div>
                )}
            </div>

            <button 
                onClick={() => {
                  if (engineRef.current) engineRef.current.gameState = 'menu';
                  setGameState('menu');
                }}
                className="mt-8 mb-12 px-10 py-4 bg-white text-black font-black text-xl rounded-full hover:bg-gray-200 transition-colors cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
                TORNAR AL MENÚ
            </button>
        </div>
      )}

      {/* Lobby Overlay */}
      {gameState === 'multiplayer_lobby' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-lg z-30 select-none">
            <h2 className="text-4xl font-black text-cyan-400 italic mb-2">RACING LOBBY</h2>
            <div className="bg-white/10 px-6 py-2 rounded-full border border-white/20 mb-8">
               <span className="text-white font-bold">ROOM CODE: </span>
               <span className="text-yellow-400 font-bold tracking-widest text-xl">{currentRoom}</span>
            </div>

            <div className="bg-black/50 border border-white/20 p-6 rounded-xl w-full max-w-md min-h-[300px]">
                <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-4">Players ({lobbyPlayers.length})</h3>
                <div className="flex flex-col gap-3">
                    {lobbyPlayers.map((p, i) => (
                        <div key={p.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex justify-between items-center text-white font-bold">
                            <span>{p.name || `Player ${i + 1}`}</span>
                            {p.id === engineRef.current?.network.socketId && <span className="text-cyan-400 text-xs uppercase bg-cyan-900/40 px-2 py-1 rounded">You</span>}
                        </div>
                    ))}
                </div>
            </div>

             {countdown !== null ? (
                <div className="mt-8 text-6xl font-black text-white italic animate-pulse drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                  STARTING IN {countdown}...
                </div>
             ) : (
                <button 
                    onClick={handleStartMultiplayer}
                    className="mt-8 w-full max-w-md py-4 bg-gradient-to-b from-cyan-400 to-blue-600 text-white font-black text-2xl italic tracking-wider rounded-lg border-b-4 border-blue-800 hover:translate-y-1 hover:border-b-0 transition-all shadow-xl active:scale-95 cursor-pointer pointer-events-auto"
                >
                    START RACE
                </button>
             )}
        </div>
      )}

      {/* Game Over overlay */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-20 select-none">
            {multiplayerResults ? (
               <h2 className="text-6xl md:text-7xl font-black text-yellow-500 italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-6">RACE FINISHED!</h2>
            ) : (
               <h2 className="text-7xl font-black text-red-500 italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-6">CRASHED!</h2>
            )}
            
            {multiplayerResults ? (
               <div className="bg-black/60 backdrop-blur-md p-8 rounded-2xl border border-white/20 flex flex-col items-stretch shadow-2xl min-w-[400px]">
                   <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-4 text-center">Final Standings</h3>
                   {multiplayerResults.map((p, i) => (
                       <div key={p.id} className={`flex justify-between items-center p-3 my-1 rounded border ${i === 0 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' : 'bg-white/5 border-white/10 text-white'}`}>
                           <span className="font-bold">{i + 1}. {p.name || `Player ${p.id.substring(0,4)}`} {p.id === engineRef.current?.network.socketId && '(You)'}</span>
                           <span className="font-black tabular-nums">{p.distance} m</span>
                       </div>
                   ))}
               </div>
            ) : (
                <div className="bg-black/60 backdrop-blur-md p-8 rounded-2xl border border-white/20 flex flex-col items-center shadow-2xl min-w-[300px]">
                    <div className="text-xs uppercase tracking-widest text-red-400 font-bold mb-1">Final Distance</div>
                    <span className="text-6xl font-black text-white tabular-nums my-2 drop-shadow-md">{distance}m</span>
                    <div className="mt-2 flex items-center gap-2 bg-yellow-500/20 px-4 py-1 rounded-full border border-yellow-500/50">
                        <span className="text-yellow-400 font-bold text-sm">+{sessionCoins} COINS</span>
                    </div>
                    <div className="w-full h-px bg-white/10 my-4"></div>
                    <div className="flex justify-between w-full text-sm font-bold">
                    <span className="text-gray-400 uppercase tracking-widest">Best</span>
                    <span className="text-cyan-400 tabular-nums">{highScore}m</span>
                    </div>
                </div>
            )}
            
            <button 
                onClick={(e) => { e.currentTarget.blur(); engineRef.current?.gameState === 'gameover' && (engineRef.current.gameState = 'menu'); setGameState('menu'); }}
                className="mt-10 px-12 py-4 bg-gradient-to-b from-cyan-400 to-blue-600 text-white font-black text-2xl italic tracking-wider rounded-lg border-b-4 border-blue-800 hover:translate-y-1 hover:border-b-0 transition-all shadow-xl active:scale-95 cursor-pointer pointer-events-auto"
            >
                {multiplayerResults ? 'BACK TO MENU' : 'PLAY AGAIN'}
            </button>
        </div>
      )}
    </div>
  );
}
