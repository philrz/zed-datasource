import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  DateTime,
} from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string; // It's not clear to me why I needed this but not "annotations: object;"

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.jsonData.url || 'http://localhost:9867';
    this.annotations = {};
  }

  async doRequest(query: MyQuery, from: DateTime, to: DateTime) {
    const pool = query.pool || 'default';
    const zedQuery = query.queryText || '*';
    const timeField = query.timeField || 'ts';
    const rangeFrom = from.toISOString();
    const rangeTo = to.toISOString();
    const wholeQuery =
      'from ' + pool + ' range ' + rangeFrom + ' to ' + rangeTo + ' | ' + zedQuery + ' | sort ' + timeField;
    console.log('Zed Query: ' + wholeQuery);

    const result = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: wholeQuery },
    });

    return result;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;

    const promises = options.targets.map((query) =>
      this.doRequest(query, range!.from, range!.to).then((response) => {
        const timeField = query.timeField || 'ts';

        var validFields: Array<{ name: string; type: FieldType }> = [];
        for (const key in response.data[0]) {
          if (key === timeField) {
            validFields.push({ name: timeField, type: FieldType.time });
          } else if (typeof response.data[0][key] === 'string') {
            validFields.push({ name: key, type: FieldType.string });
          } else if (typeof response.data[0][key] === 'number') {
            validFields.push({ name: key, type: FieldType.number });
          } else if (typeof response.data[0][key] === 'boolean') {
            validFields.push({ name: key, type: FieldType.boolean });
          }
        }

        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: validFields,
        });

        response.data.forEach((point: any) => {
          frame.appendRow(
            validFields.map(function (f) {
              if (f.name === timeField) {
                return +new Date(point[f.name]);
              } else {
                return point[f.name];
              }
            })
          );
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
        return { status: 'success', message: 'Success - Zed lake version ' + data.version };
      } else {
        return { status: 'error', message: 'Failure - HTTP status code ' + response.status };
      }
    } catch (err) {
      return { status: 'error', message: 'Failure - Could not contact Zed lake at ' + url };
    }
  }
}
