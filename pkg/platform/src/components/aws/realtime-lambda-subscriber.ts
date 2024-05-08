import {
  ComponentResourceOptions,
  Input,
  Output,
  interpolate,
  output,
} from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Component, transform } from "../component";
import { Function, FunctionArgs } from "./function";
import { RealtimeSubscriberArgs } from "./realtime";

export interface Args extends RealtimeSubscriberArgs {
  /**
   * The IoT websocket server to use.
   */
  iot: Input<{
    /**
     * The name of the Realtime component.
     */
    name: Input<string>;
  }>;
  /**
   * The subscriber function.
   */
  subscriber: Input<string | FunctionArgs>;
}

/**
 * The `RealtimeLambdaSubscriber` component is internally used by the `Realtime` component
 * to add subscriptions to [AWS IoT endpoint](https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html).
 *
 * :::caution
 * This component is not intended for public use.
 * :::
 *
 * You'll find this component returned by the `subscribe` method of the `Realtime` component.
 */
export class RealtimeLambdaSubscriber extends Component {
  private readonly fn: Output<Function>;
  private readonly permission: aws.lambda.Permission;
  private readonly rule: aws.iot.TopicRule;

  constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
    super(__pulumiType, name, args, opts);

    const self = this;
    const iot = output(args.iot);
    const filter = normalizeFilter();
    const fn = createFunction();
    const rule = createRule();
    const permission = createPermission();

    this.fn = fn;
    this.permission = permission;
    this.rule = rule;

    function normalizeFilter() {
      return output(args.filter ?? "#");
    }

    function createFunction() {
      return Function.fromDefinition(
        `${name}Handler`,
        args.subscriber,
        {
          description: interpolate`Subscribed to ${iot.name} on ${filter}`,
        },
        undefined,
        { parent: self },
      );
    }

    function createRule() {
      return new aws.iot.TopicRule(
        `${name}Rule`,
        transform(args?.transform?.topicRule, {
          sqlVersion: "2016-03-23",
          sql: interpolate`SELECT * FROM '${filter}'`,
          enabled: true,
          lambdas: [{ functionArn: fn.arn }],
        }),
        { parent: self },
      );
    }

    function createPermission() {
      return new aws.lambda.Permission(
        `${name}Permission`,
        {
          action: "lambda:InvokeFunction",
          function: fn.name,
          principal: "iot.amazonaws.com",
          sourceArn: rule.arn,
        },
        { parent: self },
      );
    }
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    const self = this;
    return {
      /**
       * The Lambda function that'll be notified.
       */
      function: this.fn,
      /**
       * The Lambda permission.
       */
      permission: this.permission,
      /**
       * The IoT topic rule.
       */
      rule: this.rule,
    };
  }
}

const __pulumiType = "sst:aws:RealtimeLambdaSubscriber";
// @ts-expect-error
RealtimeLambdaSubscriber.__pulumiType = __pulumiType;