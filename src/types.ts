import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  pool?: string;
  queryText?: string;
  valueField?: string;
  timeField?: string;
}

export const defaultQuery: Partial<MyQuery> = {
  pool: '',
  queryText: '',
  valueField: '',
  timeField: '',
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
}
