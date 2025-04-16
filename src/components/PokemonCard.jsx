import React from 'react';

const PokemonCard = ({ pokemon, onClick }) => {
  return (
    <div className="card" onClick={() => onClick(pokemon)}>
      <img src={pokemon.image} alt={pokemon.name} />
      <h3>{pokemon.name}</h3>
    </div>
  );
};

export default PokemonCard;
