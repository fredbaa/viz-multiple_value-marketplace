import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { ComparisonDataPoint } from './ComparisonDataPoint';
import ReactHtmlParser from 'react-html-parser';
import DOMPurify from 'dompurify';

const DataPointsWrapper = styled.div`
  font-family: 'Google Sans', 'Roboto', 'Noto Sans JP', 'Noto Sans',
    'Noto Sans CJK KR', Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: ${props =>
    props.layout === 'horizontal' ? 'row' : 'column'};
  align-items: center;
  margin: 10px;
  height: 100%;
`;

const dataPointGroupDirectionDict = {
  below: 'column',
  above: 'column-reverse',
  left: 'row-reverse',
  right: 'row',
};

const DataPointGroup = styled.div`
  margin: 20px 5px;
  text-align: center;
  width: 100%;
  display: flex;
  flex-shrink: ${props => (props.layout === 'horizontal' ? 'auto' : 0)};
  flex-direction: ${props =>
    props.comparisonPlacement
      ? dataPointGroupDirectionDict[props.comparisonPlacement]
      : 'column'};
  align-items: center;
  justify-content: center;
`;
const Divider = styled.div`
  background-color: #282828;
  height: 35vh;
  width: 1px;
`;

const DataPoint = styled.div`
  display: flex;
  flex-shrink: ${props => (props.layout === 'horizontal' ? 'auto' : 0)};
  flex-direction: ${props =>
    props.titlePlacement === 'above' ? 'column' : 'column-reverse'};
  flex: 1;
`;

const DataPointTitle = styled.div`
  font-weight: 100;
  color: ${props => props.color};
  margin: 5px 0;
`;

const DataPointValue = styled.div`
  font-size: 3em;
  font-weight: 100;
  color: ${props => props.color};

  a.drillable-link {
    color: ${props => props.color};
    text-decoration: none;
  }
  :hover {
    text-decoration: underline;
  }
`;

function formatTime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return (d > 0 ? `${d}:` : '') + `${h}:${m}:${s}`;
}

function isTimeFormat(value) {
  return /^\d{1,2}:\d{2}:\d{2}$/.test(value) || /^\d{1,3}:\d{2}:\d{2}:\d{2}$/.test(value);
}

function parseTimeString(value) {
  const parts = value.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 4) {
    const [d, h, m, s] = parts;
    return d * 86400 + h * 3600 + m * 60 + s;
  }
  return null;
}

class MultipleValue extends React.PureComponent {
  constructor(props) {
    super(props);
    const initialGroupingLayout = 'horizontal';
    this.state = {
      groupingLayout: initialGroupingLayout,
      fontSize: this.calculateFontSize(initialGroupingLayout),
      clocks: {},
    };
    this.clockRefs = {};
  }

  componentDidMount() {
    window.addEventListener('resize', this.recalculateSizing);
    this.startClocks();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data) {
      this.clearClocks();
      this.startClocks();
    }
    this.recalculateSizing();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.recalculateSizing);
    this.clearClocks();
  }

  startClocks = () => {
    const { data } = this.props;
    data.forEach(dataPoint => {
      const key = dataPoint.name;
      const ref = this.clockRefs[key];
      if (ref) {
        if (dataPoint.formattedValue && isTimeFormat(dataPoint.formattedValue)) {
          let totalSeconds = parseTimeString(dataPoint.formattedValue);
          if (totalSeconds !== null) {
            const interval = setInterval(() => {
              totalSeconds += 1;
              if (ref) ref.innerText = formatTime(totalSeconds);
            }, 1000);
            this.setState(prev => ({
              clocks: { ...prev.clocks, [key]: interval },
            }));
          }
        } else {
          // Not a time format, render value as-is
          ref.innerHTML = DOMPurify.sanitize(dataPoint.html || dataPoint.formattedValue);
        }
      }
    });
  };

  clearClocks = () => {
    Object.values(this.state.clocks).forEach(clearInterval);
    this.setState({ clocks: {} });
  };

  getLayout = () => {
    const CONFIG = this.props.config;
    const fallbackLayout = 'horizontal';

    if (
      CONFIG['orientation'] === 'auto' ||
      typeof CONFIG['orientation'] === 'undefined'
    ) {
      return this.state.groupingLayout || fallbackLayout;
    }
    return CONFIG['orientation'] || fallbackLayout;
  };

  getWindowSize = () => {
    return Math.max(window.innerWidth, window.innerHeight);
  };

  calculateFontSize = (layout = this.state.groupingLayout) => {
    const multiplier = layout === 'horizontal' ? 0.015 : 0.02;
    return Math.round(this.getWindowSize() * multiplier);
  };

  handleClick = (cell, event) => {
    cell.link !== undefined
      ? LookerCharts.Utils.openDrillMenu({
          links: cell.link,
          event: event,
        })
      : LookerCharts.Utils.openDrillMenu({
          links: [],
          event: event,
        });
  };

  recalculateSizing = () => {
    const EM = 16;
    const groupingLayout = window.innerWidth >= 768 ? 'horizontal' : 'vertical';

    let CONFIG = this.props.config;

    var font_check = CONFIG.font_size_main;
    var font_size =
      font_check !== '' && typeof font_check !== 'undefined'
        ? CONFIG.font_size_main
        : this.calculateFontSize(groupingLayout);
    font_size = font_size / EM;

    this.setState({
      fontSize: font_size,
      groupingLayout,
    });
  };

  checkData = compDataPoint => {
    return !compDataPoint | (typeof !compDataPoint === 'undefined');
  };

  render() {
    const { config, data } = this.props;
    let message;
    let display = false;

    return (
      <DataPointsWrapper
        layout={this.getLayout()}
        font={config['grouping_font']}
        style={{ fontSize: `${this.state.fontSize}em` }}
      >
        {data.map((dataPoint, index) => {
          const compDataPoint = dataPoint.comparison;
          if (compDataPoint < 0 || compDataPoint > 0) {
            display = false;
          } else if (compDataPoint === 0 || compDataPoint === null) {
            display = true;
            message = <a>{'Comparison point can not be zero. Adjust the value to continue.'}</a>;
          }
          return (
            <>
              <DataPointGroup
                comparisonPlacement={
                  compDataPoint &&
                  config[`comparison_label_placement_${compDataPoint.name}`]
                }
                key={`group_${dataPoint.name}`}
                layout={this.getLayout()}
              >
                <DataPoint titlePlacement={config[`title_placement_${dataPoint.name}`]}>
                  {config[`show_title_${dataPoint.name}`] === false ? null : (
                    <DataPointTitle color={config[`style_${dataPoint.name}`]}>
                      {config[`title_override_${dataPoint.name}`] || dataPoint.label}
                    </DataPointTitle>
                  )}
                  <DataPointValue
                    color={config[`style_${dataPoint.name}`]}
                    ref={ref => (this.clockRefs[dataPoint.name] = ref)}
                    layout={this.getLayout()}
                    onClick={() => this.handleClick(dataPoint, event)}
                  />
                </DataPoint>
                {this.checkData(compDataPoint) ? null : (
                  <ComparisonDataPoint
                    config={config}
                    compDataPoint={compDataPoint}
                    dataPoint={dataPoint}
                    handleClick={this.handleClick}
                  />
                )}
              </DataPointGroup>
              {config.dividers &&
                config.orientation === 'horizontal' &&
                index < data.length - 1 && <Divider />}
            </>
          );
        })}
        {display && message}
      </DataPointsWrapper>
    );
  }
}

MultipleValue.propTypes = {
  config: PropTypes.object,
  data: PropTypes.array,
};

export default MultipleValue;
