import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  DateTime,
} from '@grafana/data';

import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string; // It's not clear to me why I needed this but not "annotations: object;"

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.jsonData.url || 'http://localhost:9867';
    this.annotations = {};
  }

  async doRequest(query: MyQuery, from: DateTime, to: DateTime, options: DataQueryRequest<MyQuery>) {
    const pool = query.pool;
    const zedQuery = query.queryText || '*';
    const timeField = query.timeField || 'ts';
    const rangeFrom = from.toISOString();
    const rangeTo = to.toISOString();

    console.log('Value of "pool" going in:');
    console.log(pool);
    if (pool === undefined) {
      const pools = await getBackendSrv().datasourceRequest({
        method: 'POST',
        url: this.url + '/query',
        data: { query: 'from :pools | cut name' },
      });
      if (pools.data.length === 0) {
        throw new Error('No pools found in lake at ' + this.url);
      } else {
        throw new Error(
          'Pool must be specified in "From". Available pools in lake at ' +
            this.url +
            ': ' +
            pools.data
              .map((p: { [x: string]: any }) => {
                return p['name'];
              })
              .join()
        );
      }
    }

    const wholeQuery =
      'from ' +
      pool +
      ' | ' +
      timeField +
      ' > ' +
      rangeFrom +
      ' and ' +
      timeField +
      ' < ' +
      rangeTo +
      ' | ' +
      zedQuery +
      ' | sort ' +
      timeField;
    console.log('Zed Query before applying variables: ' + wholeQuery);
    const finalQuery = getTemplateSrv().replace(wholeQuery, options.scopedVars, 'csv');
    console.log('Zed Query after applying variables: ' + finalQuery);

    // The Zui app is able to show its "Shapes:" count withut a special query,
    // so once I learn how I should be able to do much the same.
    const shapeQuery = finalQuery + ' | by typeof(this) | count() | yield count > 1';
    const shapeCount = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: shapeQuery },
    });
    if (shapeCount.data.length === 0) {
      throw new Error('No data points found to plot in this time range');
    } else if (shapeCount.data[0] > 1) {
      throw new Error('More than one shape detected (consider using "cut" or "fuse")');
    }

    const result = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: finalQuery },
    });

    return result;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;

    const promises = options.targets.map((query) =>
      this.doRequest(query, range!.from, range!.to, options).then((response) => {
        const timeField = query.timeField || 'ts';

        var validFields: Array<{ name: string; type: FieldType }> = [];
        for (const key in response.data[0]) {
          if (key === timeField) {
            validFields.push({ name: key, type: FieldType.time });
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
                return point[f.name] == null ? 0 : point[f.name];
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
