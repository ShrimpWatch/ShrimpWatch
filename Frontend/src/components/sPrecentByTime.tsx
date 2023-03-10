import { useEffect, useState } from 'react'
import { ShrimpPercentage, ChartData, ShrimpData } from './IQueries'
import axios from 'axios'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import '../styles/Loading.css'

async function getShrimpPercentage(timeStamp: number, dates: number): Promise<ShrimpPercentage[]> {

  const axiosInstance = axios.create({ baseURL: 'http://localhost:5000/graphql' })
  const { data } = await axiosInstance.post<ShrimpData>('', {
    query: `query shrimpPercent {
      allInputs(filter: {timeStamp: {lessThanOrEqualTo: "${timeStamp}"}}) {
        edges { node { amount timeStamp publicKey } }
      }
      allOutputs(filter: {timeStamp: {lessThanOrEqualTo: "${timeStamp}"}}) {
        edges { node { amount timeStamp publicKey } }
      }
    }`,
  })

  const dayInSeconds = 86400
  const timeStamps: number[] = Array.from({ length: dates }, (_, i) => timeStamp - (dates - i - 1) * dayInSeconds)
  const shrimps: ShrimpPercentage[] = Array.from({ length: dates }, () => ({ timestamp: 0, percentage: 0 }))

  const allInputs = data?.data?.allInputs?.edges ?? []
  const allOutputs = data?.data?.allOutputs?.edges ?? []

  let walletBalances: { [address: string]: number } = {}
  for (let { node } of [...allInputs, ...allOutputs]) {
    const { amount, publicKey, timeStamp } = node
    if (timeStamp > timeStamp - dayInSeconds) {
      break
    }
    walletBalances[publicKey] = (walletBalances[publicKey] || 0) + parseFloat(amount.toString())
  }

  for (let i = 0; i < timeStamps.length; i++) {
    const dayTimeStamp = timeStamps[i]

    for (let { node } of [...allInputs, ...allOutputs]) {
      const { amount, publicKey, timeStamp } = node
      if (timeStamp <= dayTimeStamp) {
        walletBalances[publicKey] = (walletBalances[publicKey] || 0) + parseFloat(amount.toString())
      } else {
        break
      }
    }

    const walletsWithBalanceLessThanOne = Object.values(walletBalances).filter(balance => balance > 0.0001 && balance < 1).length
    const totalWallets = Object.keys(walletBalances).length
    const percentage = totalWallets > 0 ? (walletsWithBalanceLessThanOne / totalWallets) * 100 : 0

    shrimps[i].timestamp = dayTimeStamp
    shrimps[i].percentage = +percentage.toFixed(2)
  }

  return shrimps
}

export const GetshrimpPercentChartBtc = ({ timeStamp }: { timeStamp: number }): JSX.Element => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'m' | 'w' | 'qm' | 'hy' | 'm' | 'y'>('m');

  const handleButtonClick = (timeRange: 'w' | 'm' | 'qm' | 'hy' | 'y') => {
    let days = 1;
    if (timeRange === 'w') {
      days = 7;
    } else if (timeRange === 'm') {
      days = 30;
    } else if (timeRange === 'qm') {
      days = 90
    } else if (timeRange == 'hy') {
      days = 180
    } else if (timeRange === 'y') {
      days = 365;
    }
    setSelectedTimeRange(timeRange);
    setIsLoading(true);
    getShrimpPercentage(timeStamp, days)
      .then(data => {
        const chartData: ChartData[] = data.map((item) => ({
          x: item.timestamp * 1000,
          y: item.percentage,
        }));
        chartData[0].y = null;
        chartData[chartData.length - 1].y = null;
        setChartData(chartData);
        setIsLoading(false);
      })
      .catch(() => {
        setError(true);
      });
  };

  useEffect(() => {
    handleButtonClick(selectedTimeRange);
  }, [timeStamp]);

  const data: [number, number | null][] = chartData.map((item) => {
    return [Number(item.x), item.y];
  });

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      backgroundColor: {
        linearGradient: { x1: 0, y1: 0, x2: 1, y2: 1 },
        stops: [
          [0, '#24283a'],
          [1, '#3a3f5c']
        ],
      },
      borderRadius: 10,
      style: {
        fontFamily: 'Arial',
      },
      animation: true,
    },
    credits: { enabled: false },
    title: {
      text: 'Shrimp Percentage Chart',
      style: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '24px',
      },
    },
    xAxis: {
      type: 'datetime',
      labels: {
        style: {
          color: '#fff',
          fontSize: '16px',
        },
      },
      lineColor: '#444',
    },
    yAxis: {
      title: {
        text: 'Percentage',
        style: {
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '18px',
        },
      },
      labels: {
        style: {
          color: '#fff',
          fontSize: '16px',
        },
        format: '{value}%',
      },
      gridLineColor: '#444',
      lineColor: '#444',
    },
    legend: {
      enabled: false,
    },
    series: [
      {
        name: 'Shrimp Percentage',
        data: data,
        type: 'line',
        color: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, '#91f9ac'],
            [1, '#19c09d']
          ]
        },
        lineWidth: 3,
        marker: {
          symbol: 'circle',
          radius: 5,
          fillColor: '#fff',
          lineWidth: 2,
          lineColor: '#fcff8c',
          animation: true,
          states: {
            hover: {
              fillColor: '#fcff8c',
            }
          },
        },
      },
    ],
  }
  return (
    <>
      {isLoading && <Loading />}
      {error && <p>An error occurred {error}</p>}
      {!isLoading && !error && (
        <div>
          <HighchartsReact highcharts={Highcharts} options={options} />
          <div className="time-range-buttons">
            <button className={selectedTimeRange === 'w' ? 'active' : ''} onClick={() => handleButtonClick('w')}>Week</button>
            <button className={selectedTimeRange === 'm' ? 'active' : ''} onClick={() => handleButtonClick('m')}>Month</button>
            <button className={selectedTimeRange === 'qm' ? 'active' : ''} onClick={() => handleButtonClick('qm')}>3 Month</button>
            <button className={selectedTimeRange === 'hy' ? 'active' : ''} onClick={() => handleButtonClick('hy')}>6 Month</button>
            <button className={selectedTimeRange === 'y' ? 'active' : ''} onClick={() => handleButtonClick('y')}>Year</button>
          </div>
        </div>
      )}
    </>
  )
}

const Loading = () => {
  return (
    <div className="loading">
      <div className="loading-spinner">
        <img src="src/assets/shrimp512.png" />
      </div>
      <p>Loading...</p>
    </div>
  )
}