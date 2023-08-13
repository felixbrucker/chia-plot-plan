/// <reference lib="webworker" />

import {BigNumber} from 'bignumber.js'
import {PlotPlan, PlotPlanCalculator} from './plot-plan-calculator'

addEventListener('message', ({ data }) => {
  postMessage(calculatePlotPlan(data))
})

const plotPlanCalculator = new PlotPlanCalculator()

function calculatePlotPlan(capacityInGb: number): PlotPlan {
  return plotPlanCalculator.calculateFor(new BigNumber(capacityInGb))
}
