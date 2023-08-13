import {BigNumber} from 'bignumber.js'

export interface PlotPlan {
  k32Only: {
    numberOfK32Plots: number
    spaceUsedInGb: number
  }
  k32AndK33: {
    numberOfK32: number
    numberOfK33: number
    spaceUsedInGb: number
  }
  k32AndK33AndK34: {
    numberOfK32: number
    numberOfK33: number
    numberOfK34: number
    spaceUsedInGb: number
  }
}

const plotSizesInGb = {
  k32: 108.837,
  k33: 224.227,
  k34: 461.535,
}

export class PlotPlanCalculator {
  public static get emptyPlotPlan(): PlotPlan {
    return {
      k32Only: {
        numberOfK32Plots: 0,
        spaceUsedInGb: 0,
      },
      k32AndK33: {
        numberOfK32: 0,
        numberOfK33: 0,
        spaceUsedInGb: 0,
      },
      k32AndK33AndK34: {
        numberOfK32: 0,
        numberOfK33: 0,
        numberOfK34: 0,
        spaceUsedInGb: 0,
      },
    }
  }

  public calculateFor(capacityInGb: BigNumber): PlotPlan {
    const plotPlan = PlotPlanCalculator.emptyPlotPlan
    plotPlan.k32Only.numberOfK32Plots = capacityInGb
      .dividedBy(plotSizesInGb.k32)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toNumber()
    plotPlan.k32Only.spaceUsedInGb = new BigNumber(plotPlan.k32Only.numberOfK32Plots)
      .multipliedBy(plotSizesInGb.k32)
      .toNumber()
    plotPlan.k32AndK33.spaceUsedInGb = plotPlan.k32Only.spaceUsedInGb
    plotPlan.k32AndK33.numberOfK32 = plotPlan.k32Only.numberOfK32Plots

    plotPlan.k32AndK33AndK34.spaceUsedInGb = plotPlan.k32Only.spaceUsedInGb
    plotPlan.k32AndK33AndK34.numberOfK32 = plotPlan.k32Only.numberOfK32Plots

    for (let k32Count = 0; k32Count < plotPlan.k32Only.numberOfK32Plots; k32Count++) {
      const k32UsedSpace = new BigNumber(plotSizesInGb.k32).multipliedBy(k32Count)
      const k33Count = capacityInGb
        .minus(k32UsedSpace)
        .dividedBy(plotSizesInGb.k33)
        .integerValue(BigNumber.ROUND_FLOOR)
      const usedSpaceInGb = k33Count.multipliedBy(plotSizesInGb.k33).plus(k32UsedSpace)
      if (usedSpaceInGb.isGreaterThan(plotPlan.k32AndK33.spaceUsedInGb)) {
        plotPlan.k32AndK33.numberOfK32 = k32Count
        plotPlan.k32AndK33.numberOfK33 = k33Count.toNumber()
        plotPlan.k32AndK33.spaceUsedInGb = usedSpaceInGb.toNumber()
      }
    }

    for (let k32Count = 0; k32Count < plotPlan.k32Only.numberOfK32Plots; k32Count++) {
      const k32UsedSpace = new BigNumber(plotSizesInGb.k32).multipliedBy(k32Count)
      for (let k33Count = 0; k32UsedSpace.plus(new BigNumber(plotSizesInGb.k33).multipliedBy(k33Count)).isLessThan(capacityInGb); k33Count++) {
        const k33UsedSpace = new BigNumber(plotSizesInGb.k33).multipliedBy(k33Count)
        const remainingSpaceInGb = capacityInGb.minus(k33UsedSpace).minus(k32UsedSpace)
        const k34Count = remainingSpaceInGb.dividedBy(plotSizesInGb.k34).integerValue(BigNumber.ROUND_FLOOR)
        const usedSpaceInGb = k34Count.multipliedBy(plotSizesInGb.k34).plus(k33UsedSpace).plus(k32UsedSpace)
        if (usedSpaceInGb.isGreaterThan(plotPlan.k32AndK33AndK34.spaceUsedInGb)) {
          plotPlan.k32AndK33AndK34.numberOfK32 = k32Count
          plotPlan.k32AndK33AndK34.numberOfK33 = k33Count
          plotPlan.k32AndK33AndK34.numberOfK34 = k34Count.toNumber()
          plotPlan.k32AndK33AndK34.spaceUsedInGb = usedSpaceInGb.toNumber()
        }
      }
    }

    return plotPlan
  }
}
