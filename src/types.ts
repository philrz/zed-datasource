import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  pool?: string;
  timeField?: string;
  queryText?: string;
}

export const defaultQuery: Partial<MyQuery> = {
  pool: '',
  timeField: '',
  queryText: '',
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
}
