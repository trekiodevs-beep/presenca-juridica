import React, { useEffect, useRef, useState } from 'react';
import { MapPin, LoaderCircle } from 'lucide-react';
import { Input } from './ui/Input';

interface Municipality {
  id: number;
  nome: string;
  'regiao-imediata'?: {
    'regiao-intermediaria'?: {
      UF?: {
        sigla: string;
      };
    };
  };
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla: string;
      };
    };
  };
}

interface CityStateFieldsProps {
  city: string;
  state: string;
  onCityChange: (city: string) => void;
  onStateChange: (state: string) => void;
  required?: boolean;
  idPrefix?: string;
}

const IBGE_MUNICIPALITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
let municipalitiesRequest: Promise<Municipality[]> | null = null;

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const getMunicipalityState = (municipality: Municipality) =>
  municipality.microrregiao?.mesorregiao?.UF?.sigla
  ?? municipality['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla;

const loadMunicipalities = () => {
  if (!municipalitiesRequest) {
    municipalitiesRequest = fetch(IBGE_MUNICIPALITIES_URL, {
      headers: { Accept: 'application/json' },
    })
      .then(response => {
        if (!response.ok) throw new Error(`IBGE respondeu ${response.status}`);
        return response.json() as Promise<Municipality[]>;
      })
      .catch(error => {
        municipalitiesRequest = null;
        throw error;
      });
  }

  return municipalitiesRequest;
};

export const CityStateFields: React.FC<CityStateFieldsProps> = ({
  city,
  state,
  onCityChange,
  onStateChange,
  required = false,
  idPrefix = 'public',
}) => {
  const [suggestions, setSuggestions] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const normalizedCity = city.trim();
    if (normalizedCity.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const currentRequestId = ++requestId.current;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const municipalities = await loadMunicipalities();
        if (currentRequestId !== requestId.current) return;

        const search = normalizeSearch(normalizedCity);
        const matchingMunicipalities = municipalities
          .filter(municipality => normalizeSearch(municipality.nome).includes(search))
          .sort((first, second) => {
            const firstStartsWith = normalizeSearch(first.nome).startsWith(search);
            const secondStartsWith = normalizeSearch(second.nome).startsWith(search);
            if (firstStartsWith !== secondStartsWith) return firstStartsWith ? -1 : 1;
            return first.nome.localeCompare(second.nome, 'pt-BR');
          })
          .slice(0, 8);

        setSuggestions(matchingMunicipalities);
        setIsOpen(matchingMunicipalities.length > 0);
      } catch (error) {
        console.warn('Não foi possível buscar municípios no IBGE.', error);
        if (currentRequestId === requestId.current) setSuggestions([]);
      } finally {
        if (currentRequestId === requestId.current) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      requestId.current += 1;
    };
  }, [city]);

  const selectMunicipality = (municipality: Municipality) => {
    const municipalityState = getMunicipalityState(municipality);
    onCityChange(municipality.nome);
    if (municipalityState) onStateChange(municipalityState);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="relative">
        <label htmlFor={`${idPrefix}-city`} className="block text-sm font-medium text-slate-700 mb-1.5">Cidade {required ? '*' : ''}</label>
        <div className="relative">
          <Input
            id={`${idPrefix}-city`}
            required={required}
            value={city}
            onChange={event => {
              onCityChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
            placeholder="Sua cidade"
            autoComplete="address-level2"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={`${idPrefix}-city-suggestions`}
          />
          {loading && <LoaderCircle className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 animate-spin text-slate-400" aria-label="Buscando cidades" />}
        </div>
        {isOpen && suggestions.length > 0 && (
          <ul id={`${idPrefix}-city-suggestions`} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map(municipality => {
              const municipalityState = getMunicipalityState(municipality);
              return (
                <li key={municipality.id} role="option">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => selectMunicipality(municipality)}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
                    <span>{municipality.nome}{municipalityState ? ` - ${municipalityState}` : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-state`} className="block text-sm font-medium text-slate-700 mb-1.5">UF {required ? '*' : ''}</label>
        <Input
          id={`${idPrefix}-state`}
          required={required}
          value={state}
          onChange={event => onStateChange(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
          maxLength={2}
          placeholder="SP"
          autoComplete="address-level1"
        />
      </div>
    </div>
  );
};
