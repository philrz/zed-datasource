import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  onPoolTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, pool: event.target.value });
  };

  onTimeFieldTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, timeField: event.target.value });
  };

  runQuery = () => {
    const { onRunQuery } = this.props;
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { pool, queryText, timeField } = query;

    return (
      <div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            value={pool || ''}
            onChange={this.onPoolTextChange}
            label="From"
            tooltip="poolname[@branch]"
            placeholder="default"
          />
          <FormField
            labelWidth={8}
            value={timeField || ''}
            onChange={this.onTimeFieldTextChange}
            label="Time Field"
            tooltip="Name of time field"
            placeholder="ts"
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={8}
            inputWidth={30}
            value={queryText || ''}
            onChange={this.onQueryTextChange}
            label="Zed Query"
            tooltip="Zed Query"
            placeholder="*"
          />
          <button style={{ background: '#F8771B', color: 'black' }} onClick={this.runQuery}>
            Run Query
          </button>
        </div>
      </div>
    );
  }
}
