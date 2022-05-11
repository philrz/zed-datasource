# Grafana Zed Data Source Plugin

This repository contains a prototype [data source plugin](https://grafana.com/grafana/plugins/?type=datasource)
for [Grafana](https://grafana.com/) to allow the plotting of time-series data
that's stored in [Zed lakes](https://zed.brimdata.io/docs/commands/zed/).

The motivation for writing it was to teach myself some JavaScript while
exploring the real-world readiness of the [Zed lake API](https://zed.brimdata.io/docs/lake/api/).
While you can make it work by following the instructions below, it's got plenty
of known limitations, many of which I've enumerated in a [to-do](#to-do)
section. I probably lack the skills in JavaScript and Grafana to bring the
plugin all the way to production quality on my own. Therefore,
[contributions](#contributing) are welcomed.

# Installation

As it's a prototype, these installation instructions effectively show how to
get the plugin running in a way that would allow for its further development.
Allowing for a simple "plug & play" installation is on the [to-do](#to-do) list.
I happen to use macOS on the desktop, so these instructions cover that case.

1. Install Grafana and needed development tools

```
brew update
brew install grafana nvm yarn
nvm install 16.14.2
nvm use 16.14.2
```

2. Clone the plugin repo 

```
mkdir -p $HOME/grafana-plugins
git clone https://github.com/philrz/zed-datasource.git $HOME/grafana-plugins/zed
```

3. Build the plugin

```
cd $HOME/grafana-plugins/zed
yarn install
yarn dev
```

4. Start Grafana, while setting the necessary config variables to point to the
plugin directory

```
/usr/local/opt/grafana/bin/grafana-server \
    --config /usr/local/etc/grafana/grafana.ini \
    --homepath /usr/local/opt/grafana/share/grafana \
    --packaging=brew \
    cfg:default.paths.logs=/usr/local/var/log/grafana \
    cfg:default.paths.data=/usr/local/var/lib/grafana \
    cfg:default.paths.plugins="$HOME/grafana-plugins" \
    cfg:default.plugins.allow_loading_unsigned_plugins=brim-data-zed
```

Grafana should now be listening on http://localhost:3000 and you can login with
username `admin` and password `admin`.

# Zed & CORS

Unfortunately, due to a problem with [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS),
this plugin cannot currently interact with the API for out-of-the-box Zed lake.
Therefore I've created a branch in a [personal fork of the Zed repo](https://github.com/philrz/zed)
that includes a branch with [this small change](https://github.com/philrz/zed/commit/15b6f82341177e219e534f0359b8116895ca3e1c)
that works around the issue. Until the core Zed dev team is able to provide
guidance on a proper fix, you can install a `zed` binary based on the branch
and use it to serve your test lake. For example:

```
git clone -b grafana-plugin https://github.com/philrz/zed.git $TMPDIR/zed
cd $TMPDIR/zed
make build
./dist/zed serve -lake scratch
```

# Test Data

While the plugin is ultimately capable of querying any time-series data you
manage to store in a pool, to get things started I've created a simple
`zed-cpu-logger.py` tool to poll continuously for local CPU utilization data
and push it into a Zed lake to provide a time-series for a simple "hello world"
example. See the [repo](https://github.com/philrz/zed-cpu-logger) for details
on its installation and use.

# Example Usage

The following video walks through adding the plugin config inside Grafana and
using it to plot sample data.

# Contributing

The plugin was written while following the Grafana documentation to
[build a data source plugin](https://grafana.com/tutorials/build-a-data-source-plugin/).
My JavaScript skills are pretty basic and I have no prior experience developing
Grafana plugins, so I know it has limitations. While interest in the plugin may
inspire me to continue enhancing it, I imagine someone with better skills and
experience could make progress much quicker. Please open an
[issue](https://github.com/philrz/zed-datasource/issues) before sending a pull
request.

# To Do

Having been a user of other Grafana data sources in the past, I can see some
glaring omissions in this one that form an immediate to-do list if I or anyone
else feels inspired to add further enhancements.

First, I've not yet taken steps to cover the recommended follow-on tasks from
the [Grafana docs](https://grafana.com/tutorials/build-a-data-source-plugin/)
to add support for [variables](https://grafana.com/docs/grafana/latest/developers/plugins/add-support-for-variables/),
[annotations](https://grafana.com/docs/grafana/latest/developers/plugins/add-support-for-annotations/),
and [Explore queries](https://grafana.com/docs/grafana/latest/developers/plugins/add-support-for-explore-queries/).
Also, while Grafana has traditionally been focused on time-series data, their
docs note that a plugin can also be a [logs data source](https://grafana.com/docs/grafana/latest/developers/plugins/build-a-logs-data-source-plugin/). Given
the diverse data that can be stored in Zed lakes, this would also seem to be a
logical enhancement.

Specifically for the case of variables, I suspect explicit support for
[`$__interval`](https://grafana.com/docs/grafana/latest/variables/variable-types/global-variables/#__interval)
would be helpful. Right now all time bucketing must be expressed explicitly
in the Zed query itself, but proper support for `$__interval` should make it
possible to set the bucketing dynamically based on the pixels available in a
given panel.

Another fundamental limitation of the plugin currently is that it's only
capable of handling one time-series per query. Consider a Zed query such as:

```
$ zed query -use http -f table 'count() by every(1s),method'
ts                   method           count
2018-03-24T17:15:20Z OPTIONS          1
2018-03-24T17:15:20Z POST             1
2018-03-24T17:15:20Z GET              63
2018-03-24T17:15:20Z PUT              1
2018-03-24T17:15:21Z GET              35
2018-03-24T17:15:21Z HEAD             1
2018-03-24T17:15:21Z PRI              1
...
```

More advanced plugins expose knobs that would allow the easy separation of this
response into multiple separate time-series that could each be plotted with an
appropriate label, e.g., based on the different HTTP methods in this case.
Until the Zed plugin is enhanced to handle this, for now you'd need to create
one query per time-series, e.g.:

```
$ zed query -use http -f table 'count() where method=="GET" by every(1s)'
ts                   count
2018-03-24T17:15:20Z 63
2018-03-24T17:15:21Z 35

$ zed query -use http -f table 'count() where method=="POST" by every(1s)'
ts                   count
2018-03-24T17:15:20Z 1
2018-03-24T17:15:21Z 0
```

Finally, due to its prototype nature, the plugin is currently
[unsigned](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/)
and not in any way [packaged or distributed](https://grafana.com/docs/grafana/latest/developers/plugins/package-a-plugin/) for easy installation in non-test
Grafana environments.
