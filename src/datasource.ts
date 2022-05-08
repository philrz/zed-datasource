import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.jsonData.url || 'http://localhost:9867';
  }

  async doRequest(query: MyQuery) {
    let zedquery = query.queryText || '*';
    console.log('query text = ' + query.queryText);
    const result = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: 'from zeek | ' + zedquery },
    });

    return result;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const promises = options.targets.map((query) =>
      this.doRequest(query).then((response) => {
        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: [
            { name: 'Time', type: FieldType.time },
            { name: 'Value', type: FieldType.number },
          ],
        });

        response.data.forEach((point: any) => {
          frame.appendRow([point.ts, point.value]);
        });

        return frame;
      })
    );

    return Promise.all(promises).then((data) => ({ data }));
  }

  async testDatasource() {
    const url = this.url + '/version';

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return { status: 'success', message: 'Success - Lake version ' + data.version };
      } else {
        return { status: 'error', message: 'Failure - HTTP status code ' + response.status };
      }
    } catch (err) {
      return { status: 'error', message: 'Failure - Could not contact lake at ' + url };
    }
  }
}
