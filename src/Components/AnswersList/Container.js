import { compose, withStateHandlers, withHandlers, lifecycle, branch, renderComponent, withProps } from 'recompose';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { db } from '../../utils';

import AppLoader from '../Loaders/AppLoader';
import Component from './Component';

const mapStateToProps = state => ({
  user: state.user,
  sortBy: state.answerSort,
});

const enhance = compose(
  connect(mapStateToProps),
  withStateHandlers({ answers: [], users: [], votes: [], isFetching: true }),

  withRouter,

  lifecycle({
    componentWillMount() {
      this.interval = db.pooling(async () => {
        const questionId = this.props.match.params.questionId;

        let answers = await db.answers.find();
        answers = answers.filter(answer => answer.questionId === questionId);

        let votes = await db.votes.find();
        const answerIds = answers.map(a => a._id);
        votes = votes.filter(vote => answerIds.includes(vote.answerId));

        const users = await db.users.find();

        this.setState({ answers, votes, users, isFetching: false });
      });
    },
    componentWillUnmount() {
      clearInterval(this.interval);
    }
  }),

  branch(
    ({ isFetching }) => isFetching,
    renderComponent(AppLoader)
  ),

  withHandlers({
    onVote: ({ user }) => (answerId, isPositive) => {
      if (user) {
        db.votes.insert({
          answerId,
          isPositive,
          createdAt: new Date(),
          createdById: user._id,
        });
      }
    }
  }),

  withProps(props => {
    const { sortBy, answers, votes } = props;
    let sortFunc;
    if (sortBy === "best" || sortBy === "worst") {
      const karma = sortBy === "best";
      const votesByAnswer = answers.reduce((counts, answer) => {
        const id = answer._id;
        counts[id] = votes.filter(
          vote => vote.answerId === id && vote.isPositive === karma
        ).length;
        return counts;
      }, {});
      sortFunc = (a, b) => votesByAnswer[b._id] - votesByAnswer[a._id];
    } else {
      sortFunc = (a, b) => b.createdAt - a.createdAt;
    }
    return {
      answers: [...answers].sort(sortFunc)
    };
  })
);


export default enhance(Component);
