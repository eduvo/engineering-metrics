export interface NrqlResult {
  [key: string]: unknown;
}

export interface NerdGraphResponse {
  data?: {
    actor: {
      account: {
        nrql: {
          results: NrqlResult[];
        };
      };
    };
  };
  errors?: { message: string }[];
}

export interface NewRelicApplication {
  id: number;
  name: string;
}

export interface MetricTimesliceValue {
  score?: number;
  s?: number;
  t?: number;
  f?: number;
  count?: number;
  average_response_time?: number;
  calls_per_minute?: number;
  call_count?: number;
  error_count?: number;
  errors_per_minute?: number;
  [key: string]: unknown;
}

export interface MetricTimeslice {
  from: string;
  to: string;
  values: MetricTimesliceValue;
}

export interface MetricDataResult {
  name: string;
  timeslices: MetricTimeslice[];
}

export interface MetricDataResponse {
  metric_data: {
    metrics: MetricDataResult[];
  };
}
