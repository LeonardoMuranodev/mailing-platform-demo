export interface CampanasStat {
  estado: string;
  count: number;
}

export interface ColaStat {
  estado: string;
  count: number;
}

export interface RubroStat {
  rubro: string;
  cantidad_envios: number;
}

export interface HistoricoStat {
  fecha: string;
  envios: number;
}

export interface RankingCampana {
  asunto: string;
  procesados: number;
  exitosos: number;
  fallidos: number;
  aperturas: number;
}

export interface PadronStat {
  estado: string;
  count: number;
}

export interface GlobalStatsResult {
  campanas: CampanasStat[];
  cola: ColaStat[];
  rubros: RubroStat[];
  historico: HistoricoStat[];
  ranking: RankingCampana[];
  padron: PadronStat[];
  aperturasTotales: number;
  clicsTotales: number;
}

export interface GlobalStatsResponse {
  success: boolean;
  data?: GlobalStatsResult;
  error?: {
    code: string;
    message: string;
  };
}
