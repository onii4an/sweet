class ConversationController < ApplicationController
  before_action :check_user

  def index
    current_user.update('waiting' => true)
    if Boy.where(waiting: true, in_a_conversation: false).size > 0 && Girl.where(waiting: true, in_a_conversation: false).size > 0
      @offset_boy = rand(Boy.where(waiting: true).size)
      @boy_id = Boy.where(waiting: true).offset(@offset_boy).first.id
      @offset_girl = rand(Girl.where(waiting: true).size)
      @girl_id = Girl.where(waiting: true).offset(@offset_girl).first.id
      if Conversation.create('boy_id' => @boy_id, 'girl_id' => @girl_id)
        current_conversation.boy.update('in_a_conversation'=> true, 'waiting' => false)
        current_conversation.girl.update('in_a_conversation'=> true, 'waiting' => false)
        ConversationJob.perform_later('create', [@boy_id, @girl_id, Conversation.where('boy_id' => @boy_id, 'girl_id' => @girl_id).last.id])
      end
    end
  end

  def leave
    #current_conversation.destroy
    redirect_to root_path
  end

  private

  def check_user
    redirect_to root_path unless current_user
  end
end
