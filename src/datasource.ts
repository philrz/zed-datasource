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

    // The Zui app is able to show its "Shapes:" count withut a separate query,
    // so once we move the plugin to the Zealot client we should be able to do
    // the same.
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

    // Find all the fields that will be added to the data frame. The time
    // field is always made the leftmost field since black box testing has
    // indicated that if there's multiple time-typed fields Grafana will use
    // the leftmost one.
    const frameQuery = finalQuery + ' | head 1 | over this =>  ( yield {key:key[0],type:typeof(value)} )';
    const fieldsInfo = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: frameQuery },
    });
    console.log('fieldsInfo:');
    console.log(fieldsInfo);
    var frameFields: Array<{ name: string; type: FieldType }> = [];
    fieldsInfo.data.forEach((point: any) => {
      if (point.key === timeField) {
        frameFields.unshift({ name: point.key, type: FieldType.time });
      } else if (
        point.type === '<uint8>' ||
        point.type === '<uint16>' ||
        point.type === '<uint32>' ||
        point.type === '<uint64>' ||
        point.type === '<uint128>' ||
        point.type === '<uint256>' ||
        point.type === '<int8>' ||
        point.type === '<int16>' ||
        point.type === '<int32>' ||
        point.type === '<int64>' ||
        point.type === '<int128>' ||
        point.type === '<int256>' ||
        point.type === '<float16>' ||
        point.type === '<float32>' ||
        point.type === '<float64>' ||
        point.type === '<float128>' ||
        point.type === '<float256>' ||
        point.type === '<decimal32>' ||
        point.type === '<decimal64>' ||
        point.type === '<decimal128>' ||
        point.type === '<decimal256>'
      ) {
        frameFields.push({ name: point.key, type: FieldType.number });
      } else if (
        point.type === '<string>' ||
        point.type === '<ip>' ||
        point.type === '<net>' ||
        point.type === '<type>' ||
        point.type === '<bytes>'
      ) {
        frameFields.push({ name: point.key, type: FieldType.string });
      } else if (point.type === '<time>') {
        frameFields.push({ name: point.key, type: FieldType.time });
      } else if (point.type === '<bool>') {
        frameFields.push({ name: point.key, type: FieldType.boolean });
      }
    });
    console.log('frameFields:');
    console.log(frameFields);

    const result = await getBackendSrv().datasourceRequest({
      method: 'POST',
      url: this.url + '/query',
      data: { query: finalQuery },
    });

    return { f: frameFields, r: result };
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;

    const promises = options.targets.map((query) =>
      this.doRequest(query, range!.from, range!.to, options).then((foo) => {
        const timeField = query.timeField || 'ts';
        const response = foo.r;
        const validFields = foo.f;

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
