import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PokemonCard from './components/PokemonCard';
import PokemonDetails from './components/PokemonDetails';
import './styles.css';
import './components/BattleHistory.css';

const App = () => {
  const [allPokemon, setAllPokemon] = useState([]);
  const [currentList, setCurrentList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userTeam, setUserTeam] = useState([]);
  const [enemyTeam, setEnemyTeam] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedEnemy, setSelectedEnemy] = useState('');
  const [battleHistory, setBattleHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [defeatedPokemon, setDefeatedPokemon] = useState([]);

  const limit = 20;

  useEffect(() => {
    fetchAllPokemon();
   
  }, []);

  useEffect(() => {
    paginate();
  }, [allPokemon, page, search]);

  const fetchAllPokemon = async () => {
    const res = await axios.get(`https://pokeapi.co/api/v2/pokemon?limit=10000`);
    setAllPokemon(res.data.results);
  };

  

  const paginate = async () => {
    let list = allPokemon;
    if (search.trim()) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }
    const pageList = list.slice((page - 1) * limit, page * limit);
    const loaded = await Promise.all(
      pageList.map(async (poke) => {
        const data = await axios.get(poke.url);
        return {
          name: poke.name,
          image: data.data.sprites.other['official-artwork'].front_default,
          url: poke.url,
        };
      })
    );
    setCurrentList(loaded);
    setFilteredList(list);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const showDetails = async (pokemon) => {
    setIsLoading(true);
    try {
      const data = await axios.get(pokemon.url);
      const speciesData = await axios.get(data.data.species.url);
      const descriptionEntry = speciesData.data.flavor_text_entries.find(
        entry => entry.language.name === 'en'
      );
      const stats = data.data.stats.reduce((acc, stat) => {
        acc[stat.stat.name] = stat.base_stat;
        return acc;
      }, {});
      const types = data.data.types.map(t => t.type.name);
      setSelectedPokemon({
        name: pokemon.name,
        hp: stats.hp,
        attack: stats.attack,
        speed: stats.speed,
        types,
        description: descriptionEntry?.flavor_text || 'No description available.',
      });
    } catch (err) {
      console.error('Error loading Pokémon details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTeams = async (updatedUser, updatedEnemy) => {
    await axios.put(TEAM_API, {
      id: 1,
      userTeam: updatedUser,
      enemyTeam: updatedEnemy,
    });
  };

  const togglePokemon = (team, setter, name, maxLimit) => {
    return async () => {
      if (team.includes(name)) {
        const updatedTeam = team.filter(p => p !== name);
        setter(updatedTeam);
        await updateTeams(
          setter === setUserTeam ? updatedTeam : userTeam,
          setter === setEnemyTeam ? updatedTeam : enemyTeam
        );
      } else if (team.length < maxLimit) {
        const updatedTeam = [...team, name];
        setter(updatedTeam);
        await updateTeams(
          setter === setUserTeam ? updatedTeam : userTeam,
          setter === setEnemyTeam ? updatedTeam : enemyTeam
        );
      }
    };
  };

  const handleBattle = async () => {
    if (!selectedUser || !selectedEnemy) return alert("Choose Pokémon from both teams.");
    if (defeatedPokemon.includes(selectedUser) || defeatedPokemon.includes(selectedEnemy)) {
      return alert("One of the selected Pokémon has already lost.");
    }

    try {
      const [userData, enemyData] = await Promise.all([
        axios.get(`https://pokeapi.co/api/v2/pokemon/${selectedUser}`),
        axios.get(`https://pokeapi.co/api/v2/pokemon/${selectedEnemy}`),
      ]);

      const getStats = (data) => {
        const stats = data.stats.reduce((acc, stat) => {
          acc[stat.stat.name] = stat.base_stat;
          return acc;
        }, {});
        return {
          name: data.name,
          hp: stats.hp,
          attack: stats.attack,
          speed: stats.speed,
        };
      };

      const userStats = getStats(userData.data);
      const enemyStats = getStats(enemyData.data);

      let userPoints = 0;
      let enemyPoints = 0;

      if (userStats.hp > enemyStats.hp) userPoints++; else if (userStats.hp < enemyStats.hp) enemyPoints++;
      if (userStats.attack > enemyStats.attack) userPoints++; else if (userStats.attack < enemyStats.attack) enemyPoints++;
      if (userStats.speed > enemyStats.speed) userPoints++; else if (userStats.speed < enemyStats.speed) enemyPoints++;

      const winner = userPoints > enemyPoints ? userStats.name : enemyStats.name;
      const loser = userPoints < enemyPoints ? userStats.name : enemyStats.name;

      const battleResult = {
        id: Date.now(),
        userPokemon: userStats,
        enemyPokemon: enemyStats,
        winner,
        loser,
        userPoints,
        enemyPoints,
        timestamp: new Date().toISOString(),
      };

      await axios.post(HISTORY_API, battleResult);
      await fetchBattleHistory();

      alert(`Winner: ${winner.toUpperCase()}!`);
    } catch (err) {
      console.error('Battle error', err);
    }
  };

  const totalPages = Math.ceil(filteredList.length / limit);

  const getStatColor = (userVal, enemyVal) => {
    if (userVal > enemyVal) return ['green', 'red'];
    if (userVal < enemyVal) return ['red', 'green'];
    return ['gray', 'gray'];
  };
  const resetAll = async () => {
    if (window.confirm("Are you sure you want to reset all teams and battle history?")) {
      try {
        // Reset teams
        await axios.put(TEAM_API, {
          id: 1,
          userTeam: [],
          enemyTeam: []
        });
        
        // Reset battle history by replacing it with an empty array
        const historyRes = await axios.get(HISTORY_API);
        await Promise.all(
          historyRes.data.map(item => 
            axios.delete(`${HISTORY_API}/${item.id}`)
          )
        );
        
        // Update local state
        setUserTeam([]);
        setEnemyTeam([]);
        setBattleHistory([]);
        setDefeatedPokemon([]);
        setSelectedUser('');
        setSelectedEnemy('');
        
        alert("All data has been reset successfully!");
      } catch (err) {
        console.error('Reset error', err);
        alert("Error resetting data.");
      }
    }
  };
  return (
    <div className="container">
      <div className="logo-container">
  <img
    src="https://media.tenor.com/L5qC_TTSMJMAAAAi/mew-pokemon.gif"
    alt="Teleporting Mew"
    className="mew-gif"
  />
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/9/98/International_Pok%C3%A9mon_logo.svg"
    alt="Pokémon Logo"
    className="pokemon-logo"
  />
</div>

      <input
    type="text"
    className="search-input"
    placeholder="Search Pokémon..."
    value={search}
    onChange={handleSearch}
  />

      <div className="teams-container">
        <div className="team-box">
          <h2>My Team ({userTeam.length}/6)</h2>
          {userTeam.map(name => (
            <div key={name} className="team-member">
              <span>{name}</span>
              <button onClick={togglePokemon(userTeam, setUserTeam, name, 6)}>Remove</button>
              <input
                type="radio"
                name="user"
                checked={selectedUser === name}
                onChange={() => setSelectedUser(name)}
                disabled={defeatedPokemon.includes(name)}
              />
            </div>
          ))}
        </div>

        <div className="team-box">
          <h2>Enemy Team ({enemyTeam.length}/6)</h2>
          {enemyTeam.map(name => (
            <div key={name} className="team-member">
              <span>{name}</span>
              <button onClick={togglePokemon(enemyTeam, setEnemyTeam, name, 6)}>Remove</button>
              <input
                type="radio"
                name="enemy"
                checked={selectedEnemy === name}
                onChange={() => setSelectedEnemy(name)}
                disabled={defeatedPokemon.includes(name)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="button-group">
  <button onClick={handleBattle}>Battle!</button>
  <button onClick={() => setShowHistory(!showHistory)}>
    {showHistory ? 'Hide Battle History' : 'View Battle History'}
  </button>
  <button onClick={resetAll} className="reset-button">Reset All</button>
</div>

      {showHistory && (
        <div className="battle-history">
          <h2 style={{ fontSize: '0.6rem', color: 'white' }}>
    Battle History
  </h2>
          <table className="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User Pokémon</th>
                <th>Enemy Pokémon</th>
                <th>HP</th>
                <th>ATK</th>
                <th>SPD</th>
                <th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {battleHistory.map(b => {
                const [hpUserColor, hpEnemyColor] = getStatColor(b.userPokemon.hp, b.enemyPokemon.hp);
                const [atkUserColor, atkEnemyColor] = getStatColor(b.userPokemon.attack, b.enemyPokemon.attack);
                const [spdUserColor, spdEnemyColor] = getStatColor(b.userPokemon.speed, b.enemyPokemon.speed);
                return (
                  <tr key={b.id}>
                    <td>{new Date(b.timestamp).toLocaleString()}</td>
                    <td>{b.userPokemon.name}</td>
                    <td>{b.enemyPokemon.name}</td>
                    <td>
                      <span className={`stat ${hpUserColor}`}>{b.userPokemon.hp}</span> vs <span className={`stat ${hpEnemyColor}`}>{b.enemyPokemon.hp}</span>
                    </td>
                    <td>
                      <span className={`stat ${atkUserColor}`}>{b.userPokemon.attack}</span> vs <span className={`stat ${atkEnemyColor}`}>{b.enemyPokemon.attack}</span>
                    </td>
                    <td>
                      <span className={`stat ${spdUserColor}`}>{b.userPokemon.speed}</span> vs <span className={`stat ${spdEnemyColor}`}>{b.enemyPokemon.speed}</span>
                    </td>
                    <td>{b.winner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid">
        {currentList.map(pokemon => {
          const isInUser = userTeam.includes(pokemon.name);
          const isInEnemy = enemyTeam.includes(pokemon.name);

          return (
            <div key={pokemon.name} className="card">
              <img src={pokemon.image} alt={pokemon.name} onClick={() => showDetails(pokemon)} />
              <h3>{pokemon.name}</h3>
              <div className="team-buttons">
                <button
                  disabled={(userTeam.includes(pokemon.name) && !isInUser) || (userTeam.length >= 6 && !isInUser)}
                  onClick={togglePokemon(userTeam, setUserTeam, pokemon.name, 6)}
                >
                  {isInUser ? 'Remove from My Team' : 'Add to My Team'}
                </button>
                <button
                  disabled={(enemyTeam.includes(pokemon.name) && !isInEnemy) || (enemyTeam.length >= 6 && !isInEnemy)}
                  onClick={togglePokemon(enemyTeam, setEnemyTeam, pokemon.name, 6)}
                >
                  {isInEnemy ? 'Remove from Enemy' : 'Add to Enemy'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      <PokemonDetails details={selectedPokemon} onClose={() => setSelectedPokemon(null)} isLoading={isLoading} />
    </div>
  );
};

export default App;
