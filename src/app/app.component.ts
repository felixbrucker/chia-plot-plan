import { Component } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public possibleCapacityDenominators: string[] = ['GB', 'TB'];
  public capacity = 0;
  public plotPlan = AppComponent.emptyPlotPlan;
  public isCalculating = false;

  private plotSizesInGb = {
    k32: 108.837,
    k33: 224.227,
    k34: 461.535,
  };
  private _selectedCapacityDenominator = 'GB';
  private worker: Worker | null = null;
  private readonly debouncedPlotPlanUpdate: () => void;

  constructor() {
    this.initializeWebWorker();
    this.debouncedPlotPlanUpdate = debounce(() => {
      if (this.worker !== null) {
        this.isCalculating = true;
        this.worker.postMessage(this.capacityInGb);
      } else {
        this.plotPlan = this.calculatePlotPlan();
      }
    }, 200, { leading: true });
  }

  public get errorString() {
    if (this.capacity < 0) {
      return 'Your capacity can\'t be negative';
    }
    if (this.worker == null && this.capacityInGb > 1000000) {
      return 'Your capacity is too large, currently at most 100TB are supported';
    }

    return null;
  }

  public updatePlotPlan() {
    if (this.errorString) {
      return;
    }
    if (!this.capacity) {
      this.plotPlan = AppComponent.emptyPlotPlan;
      return;
    }
    this.debouncedPlotPlanUpdate();
  }

  public getPercentageOfCapacity(spaceInGb: number) {
    if (this.errorString) {
      return 0;
    }
    if (!this.capacity) {
      return 0;
    }
    return new BigNumber(spaceInGb).dividedBy(this.capacityInGb).multipliedBy(100).decimalPlaces(2).toString();
  }

  public convertCapacityInGbToDenominator(capacityInGb: number) {
    switch (this.selectedCapacityDenominator) {
      case 'TB': return new BigNumber(capacityInGb).dividedBy(1000).toNumber();
      default: return capacityInGb;
    }
  }

  get selectedCapacityDenominator(): string {
    return this._selectedCapacityDenominator;
  }

  set selectedCapacityDenominator(value: string) {
    let convertedValue = null;
    if (this._selectedCapacityDenominator !== value) {
      switch (value) {
        case 'TB':
          convertedValue = new BigNumber(this.capacityInGb).dividedBy(1000).toNumber();
          break;
        case 'GB':
          convertedValue = this.capacityInGb;
          break;
      }
    }
    this._selectedCapacityDenominator = value;
    if (convertedValue !== null) {
      this.capacity = convertedValue;
    }
  }

  private calculatePlotPlan() {
    const plotPlan = AppComponent.emptyPlotPlan;
    plotPlan.k32Only.numberOfK32Plots = new BigNumber(this.capacityInGb)
      .dividedBy(this.plotSizesInGb.k32)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toNumber();
    plotPlan.k32Only.spaceUsedInGb = new BigNumber(plotPlan.k32Only.numberOfK32Plots)
      .multipliedBy(this.plotSizesInGb.k32)
      .toNumber();
    plotPlan.k32AndK33.spaceUsedInGb = plotPlan.k32Only.spaceUsedInGb;
    plotPlan.k32AndK33.numberOfK32 = plotPlan.k32Only.numberOfK32Plots;

    plotPlan.k32AndK33AndK34.spaceUsedInGb = plotPlan.k32Only.spaceUsedInGb;
    plotPlan.k32AndK33AndK34.numberOfK32 = plotPlan.k32Only.numberOfK32Plots;

    for (let k32Count = 0; k32Count < plotPlan.k32Only.numberOfK32Plots; k32Count++) {
      const k32UsedSpace = new BigNumber(this.plotSizesInGb.k32).multipliedBy(k32Count);
      const k33Count = new BigNumber(this.capacityInGb)
        .minus(k32UsedSpace)
        .dividedBy(this.plotSizesInGb.k33)
        .integerValue(BigNumber.ROUND_FLOOR);
      const usedSpaceInGb = k33Count.multipliedBy(this.plotSizesInGb.k33).plus(k32UsedSpace);
      if (usedSpaceInGb.isGreaterThan(plotPlan.k32AndK33.spaceUsedInGb)) {
        plotPlan.k32AndK33.numberOfK32 = k32Count;
        plotPlan.k32AndK33.numberOfK33 = k33Count.toNumber();
        plotPlan.k32AndK33.spaceUsedInGb = usedSpaceInGb.toNumber();
      }
    }

    for (let k32Count = 0; k32Count < plotPlan.k32Only.numberOfK32Plots; k32Count++) {
      const k32UsedSpace = new BigNumber(this.plotSizesInGb.k32).multipliedBy(k32Count);
      for (let k33Count = 0; k32UsedSpace.plus(new BigNumber(this.plotSizesInGb.k33).multipliedBy(k33Count)).isLessThan(this.capacityInGb); k33Count++) {
        const k33UsedSpace = new BigNumber(this.plotSizesInGb.k33).multipliedBy(k33Count);
        const remainingSpaceInGb = new BigNumber(this.capacityInGb).minus(k33UsedSpace).minus(k32UsedSpace);
        const k34Count = remainingSpaceInGb.dividedBy(this.plotSizesInGb.k34).integerValue(BigNumber.ROUND_FLOOR);
        const usedSpaceInGb = k34Count.multipliedBy(this.plotSizesInGb.k34).plus(k33UsedSpace).plus(k32UsedSpace);
        if (usedSpaceInGb.isGreaterThan(plotPlan.k32AndK33AndK34.spaceUsedInGb)) {
          plotPlan.k32AndK33AndK34.numberOfK32 = k32Count;
          plotPlan.k32AndK33AndK34.numberOfK33 = k33Count;
          plotPlan.k32AndK33AndK34.numberOfK34 = k34Count.toNumber();
          plotPlan.k32AndK33AndK34.spaceUsedInGb = usedSpaceInGb.toNumber();
        }
      }
    }

    return plotPlan;
  }

  private get capacityInGb() {
    switch (this.selectedCapacityDenominator) {
      case 'TB': return new BigNumber(this.capacity).multipliedBy(1000).toNumber();
      default: return this.capacity;
    }
  }

  private initializeWebWorker() {
    if (typeof Worker === 'undefined') {
      return;
    }
    this.worker = new Worker('./app.worker', { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      this.isCalculating = false;
      this.plotPlan = data;
    };
  }

  private static get emptyPlotPlan() {
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
    };
  }
}
